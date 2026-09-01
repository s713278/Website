import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import {
  getSavedLocation,
  saveLocation,
  type CustomerLocation,
} from '@/shared/lib/customer-location'

type AddressComponent = {
  longText?: string | null
  shortText?: string | null
  types: string[]
}

type Coordinates = {
  latitude: number
  longitude: number
}

export type GoogleLocationBoundary = {
  source: 'selected-place' | 'reverse-geocode'
  formattedAddress?: string | null
  coordinates?: Coordinates
  addressComponents?: AddressComponent[]
}

export type LandingLocationSuggestion = {
  id: string
  label: string
  secondaryLabel?: string
}

export type LandingLocationSearch = {
  suggestions(input: string): Promise<LandingLocationSuggestion[]>
  select(id: string): Promise<CustomerLocation>
  reset(): void
}

const POSTAL_CODE = /^\d{6}$/
const CONFIRMATION_STORAGE_KEY = 'md-delivery-location-google-confirmation'

function componentValue(components: AddressComponent[], type: string, short = false) {
  const component = components.find((part) => part.types.includes(type))
  return (short ? component?.shortText : component?.longText)?.trim() ?? ''
}

function usableCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * The landing page's one conversion boundary from Google-shaped place data to
 * the persisted delivery-location contract. It never supplies fallback data.
 */
export function toCustomerLocation(result: GoogleLocationBoundary): CustomerLocation {
  const latitude = result.coordinates?.latitude
  const longitude = result.coordinates?.longitude
  if (!usableCoordinate(latitude) || !usableCoordinate(longitude)) {
    throw new Error('The selected location does not include usable coordinates. Choose another result.')
  }

  const components = result.addressComponents ?? []
  const country = componentValue(components, 'country', true).toUpperCase()
  if (country && country !== 'IN') {
    throw new Error('Choose a delivery location within India.')
  }

  const serviceArea = componentValue(components, 'postal_code')
  if (!POSTAL_CODE.test(serviceArea)) {
    const subject = result.source === 'reverse-geocode' ? 'your current location' : 'that location'
    throw new Error(
      `Google could not find a six-digit postal code for ${subject}. Choose a more specific address.`,
    )
  }

  const label = result.formattedAddress?.trim()
  if (!label) {
    throw new Error('Google did not return a readable address. Choose another result.')
  }

  return { serviceArea, latitude, longitude, label }
}

function isValidLocationShape(location: CustomerLocation | null): location is CustomerLocation {
  return Boolean(
    location &&
    POSTAL_CODE.test(location.serviceArea) &&
    usableCoordinate(location.latitude) &&
    usableCoordinate(location.longitude) &&
    location.label.trim(),
  )
}

export function isConfirmedLandingLocation(
  location: CustomerLocation | null,
  confirmation: CustomerLocation | null,
): location is CustomerLocation {
  return Boolean(
    isValidLocationShape(location) &&
    isValidLocationShape(confirmation) &&
    location.serviceArea === confirmation.serviceArea &&
    location.latitude === confirmation.latitude &&
    location.longitude === confirmation.longitude &&
    location.label === confirmation.label,
  )
}

function readConfirmation(): CustomerLocation | null {
  try {
    const raw = localStorage.getItem(CONFIRMATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CustomerLocation
    return isValidLocationShape(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function getConfirmedLandingLocation(): CustomerLocation | null {
  const saved = getSavedLocation()
  return isConfirmedLandingLocation(saved, readConfirmation()) ? saved : null
}

export function saveConfirmedLandingLocation(location: CustomerLocation) {
  if (!isValidLocationShape(location)) {
    throw new Error('Only a validated Google delivery location can be saved.')
  }
  saveLocation(location)
  try {
    localStorage.setItem(CONFIRMATION_STORAGE_KEY, JSON.stringify(location))
  } catch {
    /* The current page can still use the validated location for this session. */
  }
}

let loaderConfigured = false

function configureGoogleMaps() {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
  if (!key) {
    throw new Error(
      'Google location search is not configured. Add a restricted VITE_GOOGLE_MAPS_API_KEY and reload the page.',
    )
  }
  if (!loaderConfigured) {
    setOptions({ key, v: 'weekly', region: 'IN', language: 'en', authReferrerPolicy: 'origin' })
    loaderConfigured = true
  }
}

async function placesLibrary() {
  configureGoogleMaps()
  return importLibrary('places')
}

async function geocodingLibrary() {
  configureGoogleMaps()
  return importLibrary('geocoding')
}

function selectedPlaceBoundary(place: google.maps.places.Place): GoogleLocationBoundary {
  const location = place.location
  return {
    source: 'selected-place',
    formattedAddress: place.formattedAddress,
    coordinates: location
      ? { latitude: location.lat(), longitude: location.lng() }
      : undefined,
    addressComponents: place.addressComponents?.map((part) => ({
      longText: part.longText,
      shortText: part.shortText,
      types: part.types,
    })),
  }
}

function reverseGeocodeBoundary(
  result: google.maps.GeocoderResult,
  coordinates: Coordinates,
): GoogleLocationBoundary {
  return {
    source: 'reverse-geocode',
    formattedAddress: result.formatted_address,
    coordinates,
    addressComponents: result.address_components.map((part) => ({
      longText: part.long_name,
      shortText: part.short_name,
      types: part.types,
    })),
  }
}

export async function createLandingLocationSearch(): Promise<LandingLocationSearch> {
  const { AutocompleteSessionToken, AutocompleteSuggestion } = await placesLibrary()
  let sessionToken = new AutocompleteSessionToken()
  let predictions = new Map<string, google.maps.places.PlacePrediction>()
  let sessionVersion = 0

  function resetSession() {
    sessionVersion += 1
    sessionToken = new AutocompleteSessionToken()
    predictions = new Map()
  }

  return {
    async suggestions(input) {
      const query = input.trim()
      if (!query) {
        resetSession()
        return []
      }

      const requestVersion = sessionVersion
      const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        includedRegionCodes: ['in'],
        sessionToken,
      })
      if (requestVersion !== sessionVersion) return []
      predictions = new Map()
      return response.suggestions.flatMap((suggestion) => {
        const prediction = suggestion.placePrediction
        if (!prediction) return []
        predictions.set(prediction.placeId, prediction)
        return [
          {
            id: prediction.placeId,
            label: prediction.mainText?.toString() || prediction.text.toString(),
            secondaryLabel: prediction.secondaryText?.toString() || undefined,
          },
        ]
      })
    },

    async select(id) {
      const prediction = predictions.get(id)
      if (!prediction) {
        resetSession()
        throw new Error('That location suggestion is no longer available. Search again.')
      }
      try {
        const place = prediction.toPlace()
        await place.fetchFields({
          fields: ['formattedAddress', 'location', 'addressComponents'],
        })
        return toCustomerLocation(selectedPlaceBoundary(place))
      } finally {
        resetSession()
      }
    },

    reset: resetSession,
  }
}

function browserCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new Error(
          'Location is not supported in this browser. Search for your delivery location instead.',
        ),
      )
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () =>
        reject(
          new Error(
            'Location permission was not available. Allow location access or search for your delivery location.',
          ),
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}

export async function detectLandingLocation(): Promise<CustomerLocation> {
  const coordinates = await browserCoordinates()
  const { Geocoder } = await geocodingLibrary()
  const { results } = await new Geocoder().geocode({
    location: { lat: coordinates.latitude, lng: coordinates.longitude },
  })
  const result = results.find((candidate) =>
    candidate.address_components.some(
      (part) => part.types.includes('postal_code') && POSTAL_CODE.test(part.long_name),
    ),
  )
  if (!result) {
    throw new Error(
      'Google could not find a six-digit postal code for your current location. Choose a more specific address.',
    )
  }
  return toCustomerLocation(reverseGeocodeBoundary(result, coordinates))
}
