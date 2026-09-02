import {
  getSavedLocation,
  saveLocation,
  type CustomerLocation,
} from '@/shared/lib/customer-location'

type Coordinates = {
  latitude: number
  longitude: number
}

type PhotonProperties = {
  osm_type?: string
  osm_id?: string | number
  name?: string
  street?: string
  city?: string
  locality?: string
  district?: string
  county?: string
  state?: string
  country?: string
  postcode?: string
  countrycode?: string
}

type PhotonFeature = {
  properties?: PhotonProperties
  geometry?: { coordinates?: unknown[] }
}

type PhotonPayload = {
  features?: PhotonFeature[]
}

export type PhotonLocationBoundary = {
  source: 'selected-place' | 'reverse-geocode'
  coordinates?: Coordinates
  properties?: PhotonProperties
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

const PHOTON_BASE_URL = 'https://photon.komoot.io'
const POSTAL_CODE = /^\d{6}$/
const REVERSE_RADIUS_KM = 1
const REVERSE_LAYERS = ['house', 'street', 'locality']
const CONFIRMATION_STORAGE_KEY = 'md-delivery-location-photon-confirmation'

function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text || undefined
}

function usableCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function pincodeResolutionError(source: PhotonLocationBoundary['source']) {
  const subject = source === 'reverse-geocode' ? 'your current location' : 'this place'
  return new Error(
    `We couldn't identify the pincode for ${subject}. Search by a nearby address or pincode.`,
  )
}

function unique(values: Array<string | undefined>) {
  return values.filter(
    (value, index, list): value is string => Boolean(value) && list.indexOf(value) === index,
  )
}

function locationParts(properties: PhotonProperties) {
  const name = nonEmpty(properties.name) ?? nonEmpty(properties.street)
  const locality =
    nonEmpty(properties.city) ??
    nonEmpty(properties.locality) ??
    nonEmpty(properties.district) ??
    nonEmpty(properties.county)
  const state = nonEmpty(properties.state)
  const postcode = nonEmpty(properties.postcode)
  const region = [state, postcode].filter(Boolean).join(' ') || undefined
  return unique([name, locality, region, nonEmpty(properties.country)])
}

function locationLabel(properties: PhotonProperties) {
  return locationParts(properties).join(', ')
}

/** Photon boundary data → the persisted delivery-location contract, without fallbacks. */
export function toCustomerLocation(result: PhotonLocationBoundary): CustomerLocation {
  const latitude = result.coordinates?.latitude
  const longitude = result.coordinates?.longitude
  if (!usableCoordinate(latitude) || !usableCoordinate(longitude)) {
    throw new Error('The selected location does not include usable coordinates. Choose another result.')
  }

  const properties = result.properties ?? {}
  if (nonEmpty(properties.countrycode)?.toUpperCase() !== 'IN') {
    throw new Error('Choose a delivery location within India.')
  }

  const serviceArea = nonEmpty(properties.postcode) ?? ''
  if (!POSTAL_CODE.test(serviceArea)) {
    throw pincodeResolutionError(result.source)
  }

  const label = locationLabel(properties)
  if (!label) {
    throw new Error('We could not read that address. Search for another location.')
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
    throw new Error('Only a validated delivery location can be saved.')
  }
  saveLocation(location)
  try {
    localStorage.setItem(CONFIRMATION_STORAGE_KEY, JSON.stringify(location))
  } catch {
    /* The current page can still use the validated location for this session. */
  }
}

function featureCoordinates(feature: PhotonFeature): Coordinates | undefined {
  const [longitude, latitude] = feature.geometry?.coordinates ?? []
  return usableCoordinate(latitude) && usableCoordinate(longitude)
    ? { latitude, longitude }
    : undefined
}

function featureBoundary(
  feature: PhotonFeature,
  source: PhotonLocationBoundary['source'],
  coordinates = featureCoordinates(feature),
): PhotonLocationBoundary {
  return { source, coordinates, properties: feature.properties }
}

async function photonFeatures(
  path: '/api/' | '/reverse',
  params: Record<string, string | string[]>,
  signal?: AbortSignal,
) {
  const url = new URL(path, PHOTON_BASE_URL)
  for (const [name, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) url.searchParams.append(name, item)
  }
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Location search is temporarily unavailable. Try again.')
  const payload = (await response.json()) as PhotonPayload
  return Array.isArray(payload.features) ? payload.features : []
}

function distanceKm(from: Coordinates, to: Coordinates) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = radians(to.latitude - from.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const fromLatitude = radians(from.latitude)
  const toLatitude = radians(to.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

async function reversePhoton(
  coordinates: Coordinates,
  source: PhotonLocationBoundary['source'],
  signal?: AbortSignal,
) {
  const features = await photonFeatures(
    '/reverse',
    {
      lat: String(coordinates.latitude),
      lon: String(coordinates.longitude),
      limit: '10',
      radius: String(REVERSE_RADIUS_KM),
      layer: REVERSE_LAYERS,
      lang: 'en',
    },
    signal,
  )
  const candidates = features
    .flatMap((feature) => {
      const candidateCoordinates = featureCoordinates(feature)
      const properties = feature.properties ?? {}
      const postcode = nonEmpty(properties.postcode) ?? ''
      if (
        !candidateCoordinates ||
        nonEmpty(properties.countrycode)?.toUpperCase() !== 'IN' ||
        !POSTAL_CODE.test(postcode)
      ) {
        return []
      }
      const distance = distanceKm(coordinates, candidateCoordinates)
      return distance <= REVERSE_RADIUS_KM ? [{ feature, distance, postcode }] : []
    })
    .sort((left, right) => left.distance - right.distance)

  const postcodes = new Set(candidates.map((candidate) => candidate.postcode))
  if (postcodes.size !== 1) throw pincodeResolutionError(source)
  return candidates[0].feature
}

function suggestionText(properties: PhotonProperties) {
  const parts = locationParts(properties)
  return { label: parts[0] ?? 'Location', secondaryLabel: parts.slice(1).join(', ') || undefined }
}

function suggestionId(feature: PhotonFeature, index: number) {
  const properties = feature.properties ?? {}
  const coordinates = feature.geometry?.coordinates ?? []
  return `${properties.osm_type ?? 'feature'}:${properties.osm_id ?? index}:${coordinates.join(',')}`
}

export async function createLandingLocationSearch(): Promise<LandingLocationSearch> {
  let latestPredictions = new Map<string, PhotonFeature>()
  let selectablePredictions = new Map<string, PhotonFeature>()
  let controller: AbortController | null = null

  function abortRequest() {
    controller?.abort()
    controller = null
  }

  function reset() {
    abortRequest()
    latestPredictions = new Map()
    selectablePredictions = new Map()
  }

  return {
    async suggestions(input) {
      const query = input.trim()
      abortRequest()
      if (!query) {
        reset()
        return []
      }

      const searchController = new AbortController()
      controller = searchController
      let features: PhotonFeature[]
      try {
        features = await photonFeatures(
          '/api/',
          { q: `${query}, India`, limit: '5', lang: 'en' },
          searchController.signal,
        )
      } finally {
        if (controller === searchController) controller = null
      }

      const nextPredictions = new Map<string, PhotonFeature>()
      const suggestions = features.flatMap((feature, index) => {
        const properties = feature.properties ?? {}
        if (
          nonEmpty(properties.countrycode)?.toUpperCase() !== 'IN' ||
          !featureCoordinates(feature)
        ) {
          return []
        }
        const id = suggestionId(feature, index)
        nextPredictions.set(id, feature)
        return [{ id, ...suggestionText(properties) }]
      })
      selectablePredictions = new Map([...latestPredictions, ...nextPredictions])
      latestPredictions = nextPredictions
      return suggestions
    },

    async select(id) {
      const feature = selectablePredictions.get(id)
      if (!feature) {
        reset()
        throw new Error('That location suggestion is no longer available. Search again.')
      }
      const coordinates = featureCoordinates(feature)
      if (!coordinates) {
        reset()
        throw new Error('The selected location does not include usable coordinates. Choose another result.')
      }

      abortRequest()
      try {
        const properties = feature.properties ?? {}
        if (POSTAL_CODE.test(nonEmpty(properties.postcode) ?? '')) {
          return toCustomerLocation(featureBoundary(feature, 'selected-place', coordinates))
        }

        controller = new AbortController()
        const reverseFeature = await reversePhoton(
          coordinates,
          'selected-place',
          controller.signal,
        )
        const reverseProperties = reverseFeature.properties ?? {}
        return toCustomerLocation({
          source: 'selected-place',
          coordinates,
          properties: {
            ...reverseProperties,
            ...properties,
            postcode: reverseProperties.postcode,
            country: properties.country ?? reverseProperties.country,
            countrycode: properties.countrycode ?? reverseProperties.countrycode,
          },
        })
      } finally {
        reset()
      }
    },

    reset,
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
  const feature = await reversePhoton(coordinates, 'reverse-geocode')
  return toCustomerLocation(featureBoundary(feature, 'reverse-geocode', coordinates))
}
