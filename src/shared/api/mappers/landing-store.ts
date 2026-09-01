export type LandingStore = {
  id: string
  name: string
  rating?: number
  category?: string
  distanceKm?: number
  etaMins?: number
  offer?: string
  artworkCandidates: string[]
}

export type LandingStoreArtwork =
  | { kind: 'image'; url: string }
  | { kind: 'name'; text: string }

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text || undefined
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && !value.trim()) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function usableId(value: unknown): string | undefined {
  if (typeof value === 'string') return nonEmptyString(value)
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined
}

function httpUrl(value: unknown): string | undefined {
  const url = nonEmptyString(value)
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

/** Untrusted public-home vendor row → truthful landing-card presentation. */
export function mapLandingStore(raw: Record<string, unknown>): LandingStore | null {
  const id = usableId(raw.vendor_id) ?? usableId(raw.id)
  const name = nonEmptyString(raw.business_name) ?? nonEmptyString(raw.name)
  if (!id || !name) return null

  const banner = httpUrl(raw.banner_image)
  const thumbnail = httpUrl(raw.thumbnail_image)
  const artworkCandidates = [banner, thumbnail].filter(
    (url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index,
  )

  const store: LandingStore = { id, name, artworkCandidates }
  const rating = finiteNumber(raw.rating)
  const category = nonEmptyString(raw.category)
  const distanceKm = finiteNumber(raw.distance_km ?? raw.distanceKm)
  const etaMins = finiteNumber(raw.eta_mins ?? raw.etaMins)
  const offer = nonEmptyString(raw.offer)

  if (rating !== undefined) store.rating = rating
  if (category) store.category = category
  if (distanceKm !== undefined) store.distanceKm = distanceKm
  if (etaMins !== undefined) store.etaMins = etaMins
  if (offer) store.offer = offer
  return store
}

export function resolveLandingStoreArtwork(
  store: LandingStore,
  failedUrls: Iterable<string>,
): LandingStoreArtwork {
  const failed = new Set(failedUrls)
  const url = store.artworkCandidates.find((candidate) => !failed.has(candidate))
  return url ? { kind: 'image', url } : { kind: 'name', text: store.name }
}
