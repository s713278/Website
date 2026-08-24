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
  readReferenceCache,
  writeReferenceCache,
} from '../lib/onboarding-catalog-cache'
import { ONBOARDING_CONFIG, type ReferenceMode } from '../types/onboarding'

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

function usePagedReference<T extends { id: number }>(
  cacheKey: string,
  loadPage: (
    pageNumber: number,
    signal: AbortSignal,
  ) => Promise<ReferencePage<T>>,
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
      const page = await loadPageRef.current(pageNumber, controller.signal)
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
    const requestTimer = window.setTimeout(() => {
      void run(cacheKey, 0, false)
    }, 0)
    return () => {
      window.clearTimeout(requestTimer)
      requestRef.current?.abort()
    }
  }, [cacheKey, run])

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
  mode: ReferenceMode,
): BusinessTypeReferenceResult {
  const search = useBusinessTypeSearch(
    ONBOARDING_CONFIG.businessTypeSearchDebounceMs,
  )
  const cacheKey = [
    'business',
    mode,
    `query:${search.committedQuery}`,
    `size:${ONBOARDING_CONFIG.businessTypePageSize}`,
    'sort:id:ASC',
  ].join(':')
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

export function useCategoryReferences(
  mode: ReferenceMode,
  businessTypeId: number | null,
): PagedReferenceResult<CategoryReference> {
  return usePagedReference(
    `category:${mode}:${businessTypeId ?? 'none'}`,
    async (pageNumber, signal) => {
      if (businessTypeId === null) {
        return {
          items: [],
          pageNumber: 0,
          pageSize: 12,
          totalElements: 0,
          totalPages: 0,
          lastPage: true,
        }
      }
      if (mode === 'sample') {
        return getSampleCategories(businessTypeId, pageNumber, 12)
      }
      return vendorOnboardingService.getCategories(
        {
          business_type_id: businessTypeId,
          pageNumber,
          pageSize: 12,
          sortBy: 'id',
          sortOrder: 'ASC',
        },
        { signal },
      )
    },
  )
}

export function useProductReferences(
  mode: ReferenceMode,
  categoryId: number,
): PagedReferenceResult<ProductReference> {
  return usePagedReference(
    `product:${mode}:${categoryId}`,
    async (pageNumber, signal) => {
      if (mode === 'sample') {
        return getSampleProducts(categoryId, pageNumber, 12)
      }
      return vendorOnboardingService.getProductsByCategory(
        categoryId,
        { pageNumber, pageSize: 12, sortBy: 'name', sortOrder: 'ASC' },
        { signal },
      )
    },
  )
}
