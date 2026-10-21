import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getErrorMessage,
  vendorOnboardingService,
  type BusinessTypeReference,
  type CategoryReference,
  type ProductReference,
  type ReferencePage,
} from '@/shared/api'
import {
  getSampleBusinessTypes,
  getSampleCategories,
  getSampleProducts,
} from '../data/onboarding-sample'
import {
  businessTypeCacheKey,
  categoryReferenceCacheKey,
  productReferenceCacheKey,
  readReferenceCache,
  writeReferenceCache,
} from '../lib/onboarding-catalog-cache'
import { isPendingId } from '../lib/onboarding-pending-id'
import { ONBOARDING_CONFIG, type CatalogSource } from '../types/onboarding'

type PagedReferenceState<T> = {
  items: T[]
  pageNumber: number
  lastPage: boolean
  loading: boolean
  loadingMore: boolean
  error: string | null
}

type PagedReferenceResult<T> = PagedReferenceState<T> & {
  retry: () => void
  loadMore: () => void
}

type InternalPagedReferenceResult<T> = PagedReferenceResult<T> & {
  cancel: () => boolean
}

type BusinessTypeReferenceResult = PagedReferenceResult<BusinessTypeReference> & {
  searchInput: string
  setSearchInput: (value: string) => void
  committedQuery: string
  searchPending: boolean
  submitSearch: () => void
}

type KeyedPagedReferenceState<T> = PagedReferenceState<T> & {
  cacheKey: string
}

function createReferenceState<T extends { id: number }>(
  cacheKey: string,
): KeyedPagedReferenceState<T> {
  const cached = readReferenceCache<T>(cacheKey)
  return {
    cacheKey,
    items: cached?.items ?? [],
    pageNumber: cached?.pageNumber ?? 0,
    lastPage: cached?.lastPage ?? true,
    loading: !cached,
    loadingMore: false,
    error: null,
  }
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function useBusinessTypeSearch(delayMs: number) {
  const [searchInput, setSearchInputState] = useState('')
  const [committedQuery, setCommittedQuery] = useState('')
  const searchInputRef = useRef('')
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const setSearchInput = useCallback((value: string) => {
    searchInputRef.current = value
    setSearchInputState(value)
    clearTimer()

    const normalizedValue = normalizeSearch(value)
    if (!normalizedValue) {
      setCommittedQuery('')
      return
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setCommittedQuery(normalizedValue)
    }, delayMs)
  }, [clearTimer, delayMs])

  const submitSearch = useCallback(() => {
    clearTimer()
    setCommittedQuery(normalizeSearch(searchInputRef.current))
  }, [clearTimer])

  useEffect(() => clearTimer, [clearTimer])

  const normalizedInput = normalizeSearch(searchInput)
  return {
    searchInput,
    setSearchInput,
    committedQuery,
    normalizedInput,
    searchPending: normalizedInput !== committedQuery,
    submitSearch,
  }
}

/** First-page reads in flight, by cache key; an entry leaves as its read settles. */
const firstPageReads = new Map<string, Promise<ReferencePage<{ id: number }>>>()

/**
 * Read a list's first page into the cache its step paints from, joining a read of the same
 * key already in flight instead of sending another. A failure caches nothing and rejects.
 */
function readFirstPageOnce<T extends { id: number }>(
  cacheKey: string,
  loadPage: () => Promise<ReferencePage<T>>,
): Promise<ReferencePage<T>> {
  const pending = firstPageReads.get(cacheKey)
  if (pending) return pending as Promise<ReferencePage<T>>
  const read: Promise<ReferencePage<T>> = loadPage()
    .then((page) => {
      writeReferenceCache(cacheKey, page, false)
      return page
    })
    .finally(() => {
      if (firstPageReads.get(cacheKey) === read) firstPageReads.delete(cacheKey)
    })
  firstPageReads.set(cacheKey, read)
  return read
}

/** Lets each test start with no read in flight, so one left pending cannot answer the next test. */
export function resetFirstPageReadsForTests() {
  firstPageReads.clear()
}

/** `enabled: false` shows a cached page but holds the first request until it turns true. */
function usePagedReference<T extends { id: number }>(
  cacheKey: string,
  loadPage: (
    pageNumber: number,
    signal: AbortSignal,
  ) => Promise<ReferencePage<T>>,
  enabled = true,
): InternalPagedReferenceResult<T> {
  const [state, setState] = useState<KeyedPagedReferenceState<T>>(() =>
    createReferenceState<T>(cacheKey),
  )
  const activeKeyRef = useRef(cacheKey)
  const activeStateRef = useRef(state)
  const requestRef = useRef<AbortController | null>(null)
  const retryRequestRef = useRef({ cacheKey, pageNumber: 0, append: false })
  const retryLockRef = useRef(false)
  const loadMoreLockRef = useRef(false)
  const loadPageRef = useRef(loadPage)
  activeKeyRef.current = cacheKey
  loadPageRef.current = loadPage

  const run = useCallback(async (
    requestKey: string,
    pageNumber: number,
    append: boolean,
  ) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    retryRequestRef.current = { cacheKey: requestKey, pageNumber, append }

    setState((current) => {
      if (activeKeyRef.current !== requestKey) return current
      const matching = current.cacheKey === requestKey
        ? current
        : createReferenceState<T>(requestKey)
      return {
        ...matching,
        loading: !append,
        loadingMore: append,
        error: null,
        ...(append ? {} : { items: [], pageNumber: 0, lastPage: true }),
      }
    })

    try {
      // A step's own read of this first page may be in flight already: join it.
      const joined = append ? undefined : firstPageReads.get(requestKey) as Promise<ReferencePage<T>> | undefined
      const page = await (joined ?? loadPageRef.current(pageNumber, controller.signal))
      if (
        controller.signal.aborted ||
        requestRef.current !== controller ||
        activeKeyRef.current !== requestKey
      ) return

      const cached = writeReferenceCache(requestKey, page, append)
      setState({
        cacheKey: requestKey,
        ...cached,
        loading: false,
        loadingMore: false,
        error: null,
      })
    } catch (error) {
      if (
        controller.signal.aborted ||
        requestRef.current !== controller ||
        activeKeyRef.current !== requestKey
      ) return

      setState((current) => ({
        ...(current.cacheKey === requestKey
          ? current
          : createReferenceState<T>(requestKey)),
        loading: false,
        loadingMore: false,
        error: getErrorMessage(error),
      }))
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [])

  useEffect(() => {
    retryLockRef.current = false
    loadMoreLockRef.current = false
    requestRef.current?.abort()
    requestRef.current = null

    const cached = readReferenceCache<T>(cacheKey)
    if (cached) {
      setState({
        cacheKey,
        ...cached,
        loading: false,
        loadingMore: false,
        error: null,
      })
      return
    }

    setState(createReferenceState<T>(cacheKey))
    if (!enabled) return
    const requestTimer = window.setTimeout(() => {
      void run(cacheKey, 0, false)
    }, 0)
    return () => {
      window.clearTimeout(requestTimer)
      requestRef.current?.abort()
    }
  }, [cacheKey, enabled, run])

  const activeState = state.cacheKey === cacheKey
    ? state
    : createReferenceState<T>(cacheKey)
  activeStateRef.current = activeState

  const retry = useCallback(() => {
    if (retryLockRef.current) return

    const requestKey = activeKeyRef.current
    const request = retryRequestRef.current
    const pageNumber = request.cacheKey === requestKey ? request.pageNumber : 0
    const append = request.cacheKey === requestKey ? request.append : false
    retryLockRef.current = true
    if (append) loadMoreLockRef.current = true

    void run(requestKey, pageNumber, append).finally(() => {
      if (activeKeyRef.current !== requestKey) return
      retryLockRef.current = false
      if (append) loadMoreLockRef.current = false
    })
  }, [run])

  const loadMore = useCallback(() => {
    const requestKey = activeKeyRef.current
    const current = activeStateRef.current
    if (
      current.cacheKey !== requestKey ||
      current.loading ||
      current.loadingMore ||
      current.error ||
      current.lastPage ||
      loadMoreLockRef.current
    ) return

    loadMoreLockRef.current = true
    void run(requestKey, current.pageNumber + 1, true).finally(() => {
      if (activeKeyRef.current === requestKey) loadMoreLockRef.current = false
    })
  }, [run])

  const cancel = useCallback(() => {
    const request = requestRef.current
    if (!request) return false

    request.abort()
    requestRef.current = null
    retryLockRef.current = false
    loadMoreLockRef.current = false
    setState((current) => current.cacheKey === activeKeyRef.current
      ? { ...current, loading: false, loadingMore: false }
      : current)
    return true
  }, [])

  return {
    items: activeState.items,
    pageNumber: activeState.pageNumber,
    lastPage: activeState.lastPage,
    loading: activeState.loading,
    loadingMore: activeState.loadingMore,
    error: activeState.error,
    retry,
    loadMore,
    cancel,
  }
}

export function useBusinessTypeReferences(
  mode: CatalogSource,
): BusinessTypeReferenceResult {
  const search = useBusinessTypeSearch(
    ONBOARDING_CONFIG.businessTypeSearchDebounceMs,
  )
  const cacheKey = businessTypeCacheKey(mode, search.committedQuery)
  const cancelledSearchKeyRef = useRef<string | null>(null)
  const references = usePagedReference(
    cacheKey,
    async (pageNumber, signal) => {
      if (mode === 'sample') {
        return getSampleBusinessTypes(
          search.committedQuery,
          pageNumber,
          ONBOARDING_CONFIG.businessTypePageSize,
        )
      }
      return vendorOnboardingService.getBusinessTypes(
        {
          keyword: search.committedQuery || undefined,
          pageNumber,
          pageSize: ONBOARDING_CONFIG.businessTypePageSize,
          sortBy: 'id',
          sortOrder: 'ASC',
        },
        { signal },
      )
    },
  )
  const cancelReferenceRequest = references.cancel
  const retryReferenceRequest = references.retry
  const committedQuery = search.committedQuery
  const normalizedInput = search.normalizedInput
  const searchPending = search.searchPending
  const updateSearchInput = search.setSearchInput

  const setSearchInput = useCallback((value: string) => {
    if (
      normalizeSearch(value) !== committedQuery &&
      cancelReferenceRequest()
    ) {
      cancelledSearchKeyRef.current = cacheKey
    }
    updateSearchInput(value)
  }, [cacheKey, cancelReferenceRequest, committedQuery, updateSearchInput])

  useEffect(() => {
    if (searchPending) {
      if (cancelReferenceRequest()) cancelledSearchKeyRef.current = cacheKey
      return
    }

    if (cancelledSearchKeyRef.current === cacheKey) {
      cancelledSearchKeyRef.current = null
      retryReferenceRequest()
      return
    }

    cancelledSearchKeyRef.current = null
  }, [
    cacheKey,
    cancelReferenceRequest,
    normalizedInput,
    retryReferenceRequest,
    searchPending,
  ])

  return {
    items: references.items,
    pageNumber: references.pageNumber,
    lastPage: references.lastPage,
    loading: references.loading,
    loadingMore: references.loadingMore,
    error: references.error,
    retry: references.retry,
    loadMore: references.loadMore,
    searchInput: search.searchInput,
    setSearchInput,
    committedQuery: search.committedQuery,
    searchPending: search.searchPending,
    submitSearch: search.submitSearch,
  }
}

/** One page of a business type's category list, as every Step 4 reader requests it. */
async function loadCategoryReferencePage(
  mode: CatalogSource,
  businessTypeId: number | null,
  pageNumber: number,
  signal?: AbortSignal,
): Promise<ReferencePage<CategoryReference>> {
  if (businessTypeId === null) {
    return {
      items: [],
      pageNumber: 0,
      pageSize: ONBOARDING_CONFIG.categoryPageSize,
      totalElements: 0,
      totalPages: 0,
      lastPage: true,
    }
  }
  if (mode === 'sample') {
    return getSampleCategories(businessTypeId, pageNumber, ONBOARDING_CONFIG.categoryPageSize)
  }
  return vendorOnboardingService.getCategories(
    {
      business_type_id: businessTypeId,
      pageNumber,
      pageSize: ONBOARDING_CONFIG.categoryPageSize,
      sortBy: 'id',
      sortOrder: 'ASC',
    },
    { signal },
  )
}

/**
 * Read a business type's first category page into the cache Step 4 paints from as it
 * mounts, so the step shows it without a request of its own. A failure caches nothing
 * and rejects; the step then reads, and retries, the page itself.
 */
export async function readCategoryReferenceFirstPage(
  mode: CatalogSource,
  businessTypeId: number,
): Promise<void> {
  await readFirstPageOnce(
    categoryReferenceCacheKey(mode, businessTypeId),
    () => loadCategoryReferencePage(mode, businessTypeId, 0),
  )
}

export function useCategoryReferences(
  mode: CatalogSource,
  businessTypeId: number | null,
): PagedReferenceResult<CategoryReference> {
  return usePagedReference(
    categoryReferenceCacheKey(mode, businessTypeId),
    (pageNumber, signal) => loadCategoryReferencePage(mode, businessTypeId, pageNumber, signal),
  )
}

/** One page of a category's product list, as every Step 5 reader requests it. */
async function loadProductReferencePage(
  mode: CatalogSource,
  categoryId: number,
  pageNumber: number,
  signal?: AbortSignal,
): Promise<ReferencePage<ProductReference>> {
  if (isPendingId(categoryId)) {
    return {
      items: [],
      pageNumber: 0,
      pageSize: ONBOARDING_CONFIG.productPageSize,
      totalElements: 0,
      totalPages: 0,
      lastPage: true,
    }
  }
  if (mode === 'sample') {
    return getSampleProducts(categoryId, pageNumber, ONBOARDING_CONFIG.productPageSize)
  }
  return vendorOnboardingService.getProductsByCategory(
    categoryId,
    { pageNumber, pageSize: ONBOARDING_CONFIG.productPageSize, sortBy: 'name', sortOrder: 'ASC' },
    { signal },
  )
}

/**
 * Read a category panel's first product page into the cache its panel paints from as it
 * mounts, so the panel shows it without a request of its own. A failure caches nothing
 * and rejects; the panel then reads, and retries, the page itself.
 */
export async function readProductReferenceFirstPage(
  mode: CatalogSource,
  categoryId: number,
): Promise<void> {
  await readFirstPageOnce(
    productReferenceCacheKey(mode, categoryId),
    () => loadProductReferencePage(mode, categoryId, 0),
  )
}

export function useProductReferences(
  mode: CatalogSource,
  categoryId: number,
  enabled = true,
): PagedReferenceResult<ProductReference> {
  return usePagedReference(
    productReferenceCacheKey(mode, categoryId),
    (pageNumber, signal) => loadProductReferencePage(mode, categoryId, pageNumber, signal),
    enabled,
  )
}
