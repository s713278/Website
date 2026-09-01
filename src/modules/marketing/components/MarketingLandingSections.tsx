import type { ComponentType, FormEvent, KeyboardEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Banknote,
  Camera,
  Check,
  Clock,
  Croissant,
  Leaf,
  LocateFixed,
  MapPin,
  MessageCircle,
  Milk,
  Palette,
  Play,
  Puzzle,
  Search,
  Sprout,
  Star,
  Store,
  Wheat,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, ShadcnInput } from '@/shared/components'
import {
  catalogService,
  getErrorMessage,
  isLiveApi,
  resolveLandingStoreArtwork,
  type LandingStore,
} from '@/shared/api'
import {
  createLandingLocationSearch,
  detectLandingLocation,
  getConfirmedLandingLocation,
  saveConfirmedLandingLocation,
  type LandingLocationSearch,
  type LandingLocationSuggestion,
} from '@/modules/marketing/lib/landing-location'
import {
  FALLBACK_LOCATION,
  getSavedLocation,
  type CustomerLocation,
} from '@/shared/lib/customer-location'

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>

const trustedSellers = [
  { icon: '🏠', title: 'Home Businesses', copy: 'Kitchen & homemade' },
  { icon: '👩‍💼', title: 'Women Entrepreneurs', copy: 'Growing direct brands' },
  { icon: '🌾', title: 'Farmers', copy: 'Fresh produce sellers' },
  { icon: '🏷️', title: 'Local Brands', copy: 'Neighbourhood favourites' },
  { icon: '🍪', title: 'Food Makers', copy: 'Snacks, sweets & more' },
  { icon: '🧵', title: 'Artisans', copy: 'Handmade crafts' },
]

const features: Array<{
  icon: Icon
  title: string
  copy: string
  tone: string
}> = [
  {
    icon: Camera,
    title: 'Instagram Ready',
    copy: 'Share products and your store link directly from your storefront to Instagram in one tap.',
    tone: 'bg-pink-100 text-pink-600',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Ordering',
    copy: 'Receive orders and chat with customers on WhatsApp — where your buyers already are.',
    tone: 'bg-emerald-100 text-emerald-700',
  },
  {
    icon: Puzzle,
    title: 'No Coding Required',
    copy: 'Manage products, pricing, delivery, and payments without any technical skills.',
    tone: 'bg-indigo-100 text-indigo-600',
  },
  {
    icon: MapPin,
    title: 'Local Discovery',
    copy: 'Help nearby customers find your store by location and category in their neighbourhood.',
    tone: 'bg-orange-100 text-orange-600',
  },
  {
    icon: Palette,
    title: 'Your Brand',
    copy: 'Own your logo, theme colour, pricing, and customer relationships — not rented shelves.',
    tone: 'bg-amber-100 text-amber-600',
  },
  {
    icon: Banknote,
    title: 'Zero Commission',
    copy: 'Keep 100% of what you earn. No marketplace cuts eating into your margins.',
    tone: 'bg-sky-100 text-sky-700',
  },
]

const setupSteps = [
  {
    title: 'Create Account',
    copy: 'Sign up with your mobile number and verify with OTP in seconds.',
  },
  {
    title: 'Create Store',
    copy: 'Add business details, logo, banner, and pick your theme colour.',
  },
  {
    title: 'Add Products',
    copy: 'Upload photos, set prices & variants, and choose delivery & payments.',
  },
  {
    title: 'Share & Sell',
    copy: 'Share on Instagram & WhatsApp and start receiving orders immediately.',
  },
]

const discoveryCategories = [
  { icon: Milk, label: 'Milk & Dairy' },
  { icon: Leaf, label: 'Vegetables' },
  { icon: Croissant, label: 'Home Food' },
  { icon: Sprout, label: 'Organic' },
  { icon: Wheat, label: 'Bakeries' },
  { icon: Store, label: 'Services' },
]

const audiences = [
  ['🥛', 'Dairy Farms'],
  ['🌾', 'Organic Farmers'],
  ['🥖', 'Bakers'],
  ['🥬', 'Vegetable Vendors'],
  ['🫙', 'Homemade Pickles'],
  ['🍫', 'Personal Care'],
  ['🧵', 'Handmade Products'],
  ['🍳', 'Home Kitchens'],
  ['🌶️', 'Spice Brands'],
  ['🪴', 'Natural Foods'],
  ['🏪', 'Local Stores'],
  ['👩‍🍳', 'Women Entrepreneurs'],
]

const comparisons = [
  ['Setup Time', '~5 minutes', 'Hours–days', '~30 minutes', 'Days–weeks'],
  ['Coding Required', 'No', 'Often yes', 'No', 'No'],
  ['WhatsApp Orders', 'Built-in', 'Limited', 'Limited', 'No'],
  ['Hyperlocal Focus', 'Yes', 'No', 'Partial', 'City-wide'],
  ['Commission', '0%', 'App fees', 'Plan fees', '15–30%'],
  ['Subscription Selling', 'Yes', 'Apps needed', 'Limited', 'Rare'],
  ['Own Your Customers', 'Yes', 'Yes', 'Yes', 'No'],
]

const testimonials = [
  {
    quote:
      'I went live on Instagram the same evening. Orders started coming on WhatsApp without any app download for my customers.',
    name: 'Lakshmi Priya',
    business: 'Homemade Pickles · Hyderabad',
    initials: 'LP',
  },
  {
    quote:
      'Zero commission matters. We keep every rupee and still look professional with our own branded storefront.',
    name: 'Ramesh',
    business: 'Straight From The Farm',
    initials: 'R',
  },
  {
    quote:
      'Setup took minutes. Delivery charges and UPI details are right in the store — customers know exactly how to order.',
    name: 'Swetha',
    business: "Geeta's Kitchen",
    initials: 'S',
  },
]

const plans = [
  {
    name: 'Starter',
    price: '₹199',
    suffix: '/month',
    features: [
      '1 storefront',
      'Up to 50 products',
      'WhatsApp ordering',
      'Basic analytics',
      'Theme colour & branding',
    ],
    action: 'Start Free',
    to: '/onboarding',
  },
  {
    name: 'Growth',
    price: '₹499',
    suffix: '/month',
    features: [
      'Unlimited products',
      'Subscription selling',
      'Advanced analytics',
      'Priority support',
      'Custom delivery & payments',
    ],
    action: 'Start Free',
    to: '/onboarding',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    suffix: 'pricing',
    features: [
      'Multiple stores',
      'Custom features',
      'API access',
      'White-label option',
      'Dedicated success manager',
    ],
    action: 'Contact Us',
    href: 'mailto:hello@mithradirect.com',
  },
] as const

function SectionHeader({ title, copy }: { title: string; copy: string }) {
  return (
    <header className="mx-auto max-w-3xl text-center">
      <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.65rem]">
        {title}
      </h2>
      <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">{copy}</p>
    </header>
  )
}

function SectionShell({
  children,
  className = '',
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={`scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 ${className}`}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  )
}

export function TrustedBySection() {
  return (
    <SectionShell className="bg-white !py-12 sm:!py-14">
      <p className="text-center text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-600 sm:text-sm">
        Trusted by thousands of local sellers
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trustedSellers.map((seller) => (
          <article
            key={seller.title}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-2xl">
              {seller.icon}
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-slate-950">{seller.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{seller.copy}</p>
            </div>
          </article>
        ))}
      </div>
    </SectionShell>
  )
}

export function FeaturesSection() {
  return (
    <SectionShell id="features" className="bg-slate-50">
      <SectionHeader
        title="Everything you need to sell locally"
        copy="Share products, take WhatsApp orders, and keep 100% of your earnings — without building an app."
      />
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const FeatureIcon = feature.icon
          return (
            <article
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
            >
              <span className={`flex size-14 items-center justify-center rounded-2xl ${feature.tone}`}>
                <FeatureIcon className="size-6" aria-hidden />
              </span>
              <h3 className="font-display mt-5 text-xl font-bold text-slate-950">{feature.title}</h3>
              <p className="mt-2 leading-7 text-slate-600">{feature.copy}</p>
            </article>
          )
        })}
      </div>
    </SectionShell>
  )
}

export function HowItWorksSection() {
  return (
    <SectionShell id="about" className="bg-white">
      <SectionHeader
        title="How MithraDirect works"
        copy="Start your online business journey in 4 simple steps."
      />
      <div className="relative mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="absolute left-[12.5%] right-[12.5%] top-[1.45rem] hidden border-t-2 border-dashed border-emerald-200 lg:block" />
        {setupSteps.map((step, index) => (
          <article
            key={step.title}
            className="relative rounded-2xl border border-slate-200 bg-white px-6 pb-7 pt-7 text-center"
          >
            <span className="relative z-10 mx-auto flex size-11 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white ring-8 ring-white">
              {index + 1}
            </span>
            <h3 className="font-display mt-5 text-lg font-bold text-slate-950">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{step.copy}</p>
          </article>
        ))}
      </div>
      <div className="mt-9 text-center">
        <Link
          to="/onboarding"
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
        >
          Start Setup Now <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </SectionShell>
  )
}

function LandingStoreCard({ store }: { store: LandingStore }) {
  const [failedArtwork, setFailedArtwork] = useState<string[]>([])
  const artwork = resolveLandingStoreArtwork(store, failedArtwork)

  return (
    <Link
      to={`/stores/${encodeURIComponent(store.id)}`}
      className="group flex w-[84%] min-w-0 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:w-auto sm:shrink"
    >
      <article className="flex h-full flex-col">
        <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-700 to-teal-900">
          {artwork.kind === 'image' ? (
            <img
              src={artwork.url}
              alt=""
              className="size-full object-cover transition duration-300 group-hover:scale-105"
              onError={() =>
                setFailedArtwork((failed) =>
                  failed.includes(artwork.url) ? failed : [...failed, artwork.url],
                )
              }
            />
          ) : (
            <span className="max-w-[18rem] px-8 text-center font-display text-2xl font-extrabold leading-tight text-white [text-wrap:balance]">
              {artwork.text}
            </span>
          )}
          {store.offer ? (
            <span className="absolute left-3 top-3 rounded-full bg-slate-950/85 px-2.5 py-1 text-[0.7rem] font-semibold text-white">
              {store.offer}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-display text-lg font-bold leading-6 text-slate-950">{store.name}</h4>
            {store.rating !== undefined ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold tabular-nums text-slate-900">
                <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                {store.rating}
              </span>
            ) : null}
          </div>
          {store.category ? <p className="mt-2 text-sm text-slate-600">{store.category}</p> : null}
          {store.etaMins !== undefined || store.distanceKm !== undefined ? (
            <p className="mt-3 flex flex-wrap gap-3 text-sm tabular-nums text-slate-500">
              {store.etaMins !== undefined ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-4" aria-hidden /> {store.etaMins} min
                </span>
              ) : null}
              {store.distanceKm !== undefined ? <span>{store.distanceKm} km away</span> : null}
            </p>
          ) : null}
          <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-emerald-700 group-hover:text-emerald-800">
            Visit store <ArrowRight className="size-4" aria-hidden />
          </span>
        </div>
      </article>
    </Link>
  )
}

function initialLandingLocation(liveApi: boolean) {
  if (liveApi) return getConfirmedLandingLocation()
  return getSavedLocation() ?? FALLBACK_LOCATION
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function ExploreStoresSection() {
  const liveApi = isLiveApi()
  const [location, setLocation] = useState<CustomerLocation | null>(() =>
    initialLandingLocation(liveApi),
  )
  const [areaInput, setAreaInput] = useState(() => initialLandingLocation(liveApi)?.label ?? '')
  const [selectedLocation, setSelectedLocation] = useState<CustomerLocation | null>(null)
  const [suggestions, setSuggestions] = useState<LandingLocationSuggestion[]>([])
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [suggestionStatus, setSuggestionStatus] = useState('')
  const [locating, setLocating] = useState(liveApi && !location)
  const [locationError, setLocationError] = useState('')
  const [stores, setStores] = useState<LandingStore[]>([])
  const [storesLoading, setStoresLoading] = useState(Boolean(location))
  const [storesError, setStoresError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const searchRef = useRef<Promise<LandingLocationSearch> | null>(null)
  const suggestionRequest = useRef(0)
  const locationRequest = useRef(0)

  function applyConfirmedLocation(next: CustomerLocation) {
    saveConfirmedLandingLocation(next)
    setLocation(next)
    setAreaInput(next.label)
    setSelectedLocation(null)
    setSuggestions([])
    setActiveSuggestion(-1)
    setLocationError('')
  }

  useEffect(() => {
    if (!liveApi || location) return
    const requestId = ++locationRequest.current
    let cancelled = false
    setLocating(true)
    void detectLandingLocation()
      .then((next) => {
        if (!cancelled && requestId === locationRequest.current) applyConfirmedLocation(next)
      })
      .catch((error) => {
        if (!cancelled && requestId === locationRequest.current) {
          setLocationError(getErrorMessage(error, 'Could not resolve your location.'))
        }
      })
      .finally(() => {
        if (!cancelled && requestId === locationRequest.current) setLocating(false)
      })
    return () => {
      cancelled = true
    }
  }, [liveApi, location])

  useEffect(() => {
    if (
      !liveApi ||
      selectedLocation ||
      areaInput === location?.label ||
      areaInput.trim().length < 2
    ) {
      setSuggestions([])
      setActiveSuggestion(-1)
      return
    }

    const requestId = ++suggestionRequest.current
    const timer = window.setTimeout(() => {
      setSuggestionStatus('Searching Google for locations…')
      searchRef.current ??= createLandingLocationSearch()
      void searchRef.current
        .then((search) => search.suggestions(areaInput))
        .then((next) => {
          if (requestId !== suggestionRequest.current) return
          setSuggestions(next)
          setActiveSuggestion(next.length ? 0 : -1)
          setSuggestionStatus(
            next.length
              ? `${next.length} location suggestion${next.length === 1 ? '' : 's'} available.`
              : 'No Google location suggestions found.',
          )
        })
        .catch((error) => {
          if (requestId !== suggestionRequest.current) return
          setSuggestions([])
          setSuggestionStatus('Location suggestions are unavailable.')
          setLocationError(getErrorMessage(error, 'Location suggestions are unavailable.'))
        })
    }, 250)

    return () => {
      suggestionRequest.current += 1
      window.clearTimeout(timer)
    }
  }, [areaInput, liveApi, location?.label, selectedLocation])

  useEffect(() => {
    if (!location) {
      setStores([])
      setStoresLoading(false)
      return
    }

    const controller = new AbortController()
    setStoresLoading(true)
    setStoresError('')
    void catalogService
      .listLandingStores(location, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setStores(next)
      })
      .catch((error) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setStoresError(getErrorMessage(error, 'Could not load stores for this delivery location.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setStoresLoading(false)
      })
    return () => controller.abort()
  }, [location, retryKey])

  async function chooseSuggestion(suggestion: LandingLocationSuggestion) {
    const requestId = ++locationRequest.current
    setLocating(false)
    setSuggestionStatus('Validating the selected Google location…')
    setLocationError('')
    try {
      searchRef.current ??= createLandingLocationSearch()
      const next = await (await searchRef.current).select(suggestion.id)
      if (requestId !== locationRequest.current) return
      setSelectedLocation(next)
      setAreaInput(next.label)
      setSuggestions([])
      setActiveSuggestion(-1)
      setSuggestionStatus('Location selected. Choose Search Stores to confirm it.')
    } catch (error) {
      if (requestId !== locationRequest.current) return
      setSelectedLocation(null)
      setLocationError(getErrorMessage(error, 'Choose another location suggestion.'))
      setSuggestionStatus('The selected location could not be validated.')
    }
  }

  function dismissSuggestions() {
    suggestionRequest.current += 1
    setSuggestions([])
    setActiveSuggestion(-1)
    const search = searchRef.current
    if (search) void search.then((adapter) => adapter.reset()).catch(() => undefined)
  }

  function onLocationKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      dismissSuggestions()
      return
    }
    if (!suggestions.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveSuggestion((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveSuggestion((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      )
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault()
      void chooseSuggestion(suggestions[activeSuggestion])
    }
  }

  function onSearchStores(event: FormEvent) {
    event.preventDefault()
    if (selectedLocation) {
      locationRequest.current += 1
      applyConfirmedLocation(selectedLocation)
    }
  }

  async function onUseMyLocation() {
    const requestId = ++locationRequest.current
    setLocating(true)
    setLocationError('')
    setSuggestionStatus('')
    try {
      const next = await detectLandingLocation()
      if (requestId === locationRequest.current) applyConfirmedLocation(next)
    } catch (error) {
      if (requestId === locationRequest.current) {
        setLocationError(getErrorMessage(error, 'Could not resolve your location.'))
      }
    } finally {
      if (requestId === locationRequest.current) setLocating(false)
    }
  }

  return (
    <section className="relative isolate overflow-hidden scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(90% 60% at 50% -10%, #ecfdf5, transparent 60%), linear-gradient(#f8fafc, #ffffff)',
        }}
      />
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600 sm:text-sm">
            Stores near you
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.65rem]">
            Your neighbourhood, now delivering
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            Set your area and meet the local makers who deliver to your door.
          </p>
        </header>

        <div className="mx-auto mt-10 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-white ring-4 ring-emerald-100">
              <MapPin className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-emerald-700">
                Delivering to
              </p>
              <p className="truncate font-display text-lg font-bold leading-tight text-slate-950 sm:text-xl">
                {location?.label ?? (locating ? 'Finding your location…' : 'Choose a location')}
              </p>
            </div>
          </div>

          {liveApi ? (
            <div className="mt-5">
              <form onSubmit={onSearchStores} className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                    <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
                    <label className="sr-only" htmlFor="explore-area">
                      Search for a delivery location
                    </label>
                    <ShadcnInput
                      id="explore-area"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={suggestions.length > 0}
                      aria-controls="explore-area-suggestions"
                      aria-activedescendant={
                        activeSuggestion >= 0
                          ? `explore-area-suggestion-${activeSuggestion}`
                          : undefined
                      }
                      aria-describedby="explore-area-status"
                      autoComplete="off"
                      value={areaInput}
                      onChange={(event) => {
                        locationRequest.current += 1
                        setLocating(false)
                        setAreaInput(event.target.value)
                        setSelectedLocation(null)
                      }}
                      onKeyDown={onLocationKeyDown}
                      onBlur={() => window.setTimeout(dismissSuggestions, 120)}
                      placeholder="Search area, address, or pincode"
                      className="h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-3 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0"
                    />
                  </div>
                  {suggestions.length ? (
                    <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                      <ul id="explore-area-suggestions" role="listbox" className="max-h-64 overflow-y-auto p-1">
                        {suggestions.map((suggestion, index) => (
                          <li
                            id={`explore-area-suggestion-${index}`}
                            key={suggestion.id}
                            role="option"
                            aria-selected={index === activeSuggestion}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => void chooseSuggestion(suggestion)}
                              className={`h-auto w-full justify-start whitespace-normal rounded-lg px-3 py-2.5 text-left text-sm ${
                                index === activeSuggestion
                                  ? 'bg-emerald-50 text-emerald-950'
                                  : 'text-slate-800 hover:bg-slate-50'
                              }`}
                            >
                              <span className="block font-semibold">{suggestion.label}</span>
                              {suggestion.secondaryLabel ? (
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  {suggestion.secondaryLabel}
                                </span>
                              ) : null}
                            </Button>
                          </li>
                        ))}
                      </ul>
                      <p className="border-t border-slate-100 px-3 py-2 text-right text-xs font-medium text-slate-500">
                        Powered by <span className="font-semibold text-[#4285f4]">Google</span>
                      </p>
                    </div>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  disabled={!selectedLocation}
                  className="shrink-0 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Search Stores
                </Button>
              </form>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void onUseMyLocation()}
                  disabled={locating}
                  className="h-auto justify-start px-0 text-sm font-semibold text-emerald-700 transition hover:bg-transparent hover:text-emerald-800 disabled:opacity-60"
                >
                  <LocateFixed className="size-4" aria-hidden />
                  {locating ? 'Locating and resolving postal code…' : 'Use Current Location'}
                </Button>
                <p id="explore-area-status" role="status" aria-live="polite" className="text-xs text-slate-500">
                  {suggestionStatus}
                </p>
              </div>
              {locationError ? (
                <p role="alert" className="mt-3 text-sm font-medium text-rose-600">
                  {locationError}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Demo mode uses sample stores and does not require Google or backend access.
            </p>
          )}
        </div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <h3 className="min-w-0 font-display text-lg font-bold text-slate-950 sm:text-xl">
            {location ? `Stores serving ${location.label}` : 'Stores for your delivery location'}
          </h3>
          {location ? (
            <Link
              to="/stores"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-emerald-700 transition hover:text-emerald-800"
            >
              See all stores <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>

        {storesLoading ? (
          <div role="status" className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm font-medium text-slate-600">
            Loading stores for this delivery location…
          </div>
        ) : null}
        {!storesLoading && storesError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-8 text-center">
            <h4 className="font-display text-lg font-bold text-slate-950">Stores could not be loaded</h4>
            <p role="alert" className="mt-2 text-sm text-rose-700">{storesError}</p>
            <Button
              type="button"
              onClick={() => setRetryKey((key) => key + 1)}
              className="mt-4 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Retry store search
            </Button>
          </div>
        ) : null}
        {!storesLoading && !storesError && location && stores.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
            <h4 className="font-display text-lg font-bold text-slate-950">No stores serve this area yet</h4>
            <p className="mt-2 text-sm text-slate-600">Choose a different delivery location to keep exploring.</p>
          </div>
        ) : null}
        {!storesLoading && !storesError && stores.length ? (
          <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
            {stores.map((store) => (
              <LandingStoreCard key={store.id} store={store} />
            ))}
          </div>
        ) : null}

        <div className="mt-10">
          <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Browse by category
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {discoveryCategories.map(({ icon: CategoryIcon, label }) => (
              <Link
                key={label}
                to="/stores"
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-5 text-center text-sm font-semibold text-slate-800 transition hover:border-emerald-300 hover:text-emerald-700"
              >
                <CategoryIcon className="size-7 text-emerald-600" aria-hidden />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function AudienceSection() {
  return (
    <SectionShell className="bg-white">
      <SectionHeader
        title="Who is MithraDirect for?"
        copy="Built for the makers, growers, and neighbourhood brands who keep communities thriving."
      />
      <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-6">
        {audiences.map(([icon, label]) => (
          <article key={label} className="text-center">
            <span className="mx-auto flex size-20 items-center justify-center rounded-full border-2 border-emerald-100 bg-emerald-50 text-3xl transition-transform hover:scale-105">
              {icon}
            </span>
            <h3 className="mt-4 text-sm font-semibold text-slate-800">{label}</h3>
          </article>
        ))}
      </div>
    </SectionShell>
  )
}

export function ComparisonSection() {
  return (
    <SectionShell className="bg-slate-50">
      <SectionHeader
        title="MithraDirect vs Others"
        copy="See why local sellers choose a WhatsApp-first, zero-commission platform."
      />
      <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 text-sm text-slate-950">
              {['Feature', 'MithraDirect', 'Shopify', 'Dukaan', 'Marketplaces'].map((heading, index) => (
                <th
                  key={heading}
                  scope="col"
                  className={`px-5 py-5 font-bold ${index === 1 ? 'bg-emerald-50 text-emerald-800' : ''}`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisons.map((row) => (
              <tr key={row[0]} className="border-t border-slate-100">
                {row.map((cell, index) => (
                  <td
                    key={cell}
                    className={`px-5 py-4 text-sm sm:text-base ${
                      index === 1
                        ? 'bg-emerald-50/70 font-bold text-emerald-700'
                        : index === 0
                          ? 'font-medium text-slate-900'
                          : 'text-slate-700'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionShell>
  )
}

export function TestimonialsSection() {
  return (
    <SectionShell className="bg-white">
      <SectionHeader
        title="Loved by Local Entrepreneurs"
        copy="Real sellers growing direct relationships with their customers."
      />
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <figure
            key={testimonial.name}
            className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-lg"
          >
            <div className="flex gap-0.5 text-amber-500" aria-label="5 out of 5 stars">
              {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} className="size-4 fill-current" aria-hidden />
              ))}
            </div>
            <blockquote className="mt-5 flex-1 text-base leading-7 text-slate-800">
              “{testimonial.quote}”
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 font-display font-bold text-emerald-800">
                {testimonial.initials}
              </span>
              <span>
                <strong className="block font-display text-slate-950">{testimonial.name}</strong>
                <span className="mt-0.5 block text-sm text-slate-500">{testimonial.business}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionShell>
  )
}

export function PricingSection() {
  return (
    <SectionShell id="pricing" className="bg-slate-50">
      <SectionHeader
        title="Simple, transparent pricing"
        copy="Start free. Upgrade when you’re ready to grow — cancel anytime."
      />
      <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={`relative flex flex-col rounded-3xl bg-white p-7 ${
              'popular' in plan && plan.popular
                ? 'border-2 border-emerald-500 shadow-xl shadow-emerald-100'
                : 'border border-slate-200'
            }`}
          >
            {'popular' in plan && plan.popular ? (
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white">
                Most Popular
              </span>
            ) : null}
            <h3 className="font-display text-xl font-bold text-slate-950">{plan.name}</h3>
            <p className="mt-5 flex items-end gap-1">
              <strong className="font-display text-4xl font-extrabold tracking-tight text-slate-950">
                {plan.price}
              </strong>
              <span className="pb-1 text-sm text-slate-500">{plan.suffix}</span>
            </p>
            <ul className="my-7 flex-1 space-y-3 text-slate-700">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <Check className="mt-0.5 size-5 shrink-0 stroke-[2.5] text-emerald-600" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            {'to' in plan ? (
              <Link
                to={plan.to}
                className={`rounded-full px-5 py-3 text-center font-bold transition ${
                  'popular' in plan && plan.popular
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                {plan.action}
              </Link>
            ) : (
              <a
                href={plan.href}
                className="rounded-full border-2 border-emerald-300 px-5 py-3 text-center font-bold text-emerald-700 transition hover:bg-emerald-50"
              >
                {plan.action}
              </a>
            )}
          </article>
        ))}
      </div>
    </SectionShell>
  )
}

export function InvitationSection() {
  return (
    <section className="bg-white px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-600 px-6 py-12 text-center text-white sm:px-12">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Ready to Grow Your Business?
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-emerald-50 sm:text-lg">
          Create your online store today and start receiving WhatsApp orders from Instagram & nearby customers.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/onboarding"
            className="rounded-full bg-emerald-500 px-7 py-3 font-bold text-white transition hover:bg-emerald-400"
          >
            Start Your Store Free
          </Link>
          <a
            href="mailto:hello@mithradirect.com?subject=MithraDirect%20demo"
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/60 px-7 py-3 font-bold text-white transition hover:bg-white/10"
          >
            <Play className="size-4 fill-current" aria-hidden /> Book a Demo
          </a>
        </div>
      </div>
    </section>
  )
}
