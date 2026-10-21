'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { R2ExplorerObject, PrefixStat } from '@/lib/r2/explorer'

export type R2View = 'objects' | 'prefixes'

interface UseR2ExplorerState {
  currentPrefix: string | null
  breadcrumb: Array<{ label: string; prefix: string }>
  objects: R2ExplorerObject[]
  prefixes: PrefixStat[]
  view: R2View
  setView: (view: R2View) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  isLoading: boolean
  truncated: boolean
  nextCursor: string | null
  selectedKeys: Set<string>
  toggleSelect: (key: string) => void
  clearSelection: () => void
  selectAll: () => void
  loadMore: () => void
  navigateToPrefix: (prefix: string | null) => void
  goUp: () => void
  deleteSelected: () => Promise<void>
  formatBytes: (bytes: number) => string
  error: string | null
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function breadcrumbForPrefix(prefix: string | null): Array<{ label: string; prefix: string }> {
  const crumbs: Array<{ label: string; prefix: string }> = []
  if (!prefix) return crumbs
  let acc = ''
  const segments = prefix.split('/').filter((s) => s.length > 0)
  for (const segment of segments) {
    acc = acc ? `${acc}/${segment}` : segment
    crumbs.push({ label: segment, prefix: acc })
  }
  return crumbs
}

export function useR2Explorer(): UseR2ExplorerState {
  const [currentPrefix, setCurrentPrefix] = useState<string | null>(null)
  const [objects, setObjects] = useState<R2ExplorerObject[]>([])
  const [prefixes, setPrefixes] = useState<PrefixStat[]>([])
  const [view, setView] = useState<R2View>('objects')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const breadcrumb = useMemo(() => breadcrumbForPrefix(currentPrefix), [currentPrefix])

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    try {
      const {
        data: { session },
      } = await createBrowserSupabaseClient().auth.getSession()
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
    } catch {
      // Supabase not configured; proceed without token (route will 401).
    }
    return headers
  }, [])

  const fetchObjects = useCallback(
    async (prefix: string | null, cursor: string | null, search: string | null): Promise<void> => {
      setIsLoading(true)
      setError(null)
      try {
        const headers = await authHeaders()
        const params = new URLSearchParams()
        if (prefix) params.set('prefix', prefix)
        if (cursor) params.set('cursor', cursor)
        if (search) params.set('search', search)
        params.set('limit', '1000')
        const res = await fetch(`/api/admin/assets/r2?${params.toString()}`, {
          headers,
          credentials: 'include',
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(await res.text())
        const json = (await res.json()) as {
          objects: R2ExplorerObject[]
          nextCursor: string | null
          truncated: boolean
          search: string | null
        }
        setObjects(cursor ? [...objects, ...json.objects] : json.objects)
        setNextCursor(json.nextCursor ?? null)
        setTruncated(Boolean(json.truncated))
        if (!search) setPrefixes([])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load R2 objects')
      } finally {
        setIsLoading(false)
      }
    },
    [authHeaders],
  )

  const fetchPrefixes = useCallback(async (parent: string | null): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const params = new URLSearchParams()
      if (parent) params.set('parent', parent)
      const res = await fetch(`/api/admin/assets/r2/prefixes?${params.toString()}`, {
        headers,
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(await res.text())
      const json = (await res.json()) as { prefixes: PrefixStat[]; parent: string | null }
      setPrefixes(json.prefixes ?? [])
      setObjects([])
      setNextCursor(null)
      setTruncated(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder sizes')
    } finally {
      setIsLoading(false)
    }
  }, [authHeaders])

  const navigateToPrefix = useCallback((prefix: string | null) => {
    setCurrentPrefix(prefix)
    setSelectedKeys(new Set())
    setView('objects')
    void fetchObjects(prefix, null, null)
    void fetchPrefixes(prefix)
  }, [fetchObjects, fetchPrefixes])

  const goUp = useCallback(() => {
    if (!currentPrefix) return
    const segments = currentPrefix.split('/').filter((s) => s.length > 0)
    segments.pop()
    const parent = segments.length === 0 ? null : segments.join('/')
    setCurrentPrefix(parent)
    setSelectedKeys(new Set())
    setView('objects')
    void fetchObjects(parent, null, null)
    void fetchPrefixes(parent)
  }, [currentPrefix, fetchObjects, fetchPrefixes])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    if (!searchQuery.trim()) {
      setObjects([])
      setNextCursor(null)
      setTruncated(false)
      void fetchObjects(currentPrefix, null, null)
      return
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true)
      setError(null)
      try {
        const headers = await authHeaders()
        const params = new URLSearchParams()
        if (currentPrefix) params.set('prefix', currentPrefix)
        params.set('search', searchQuery.trim())
        params.set('limit', '1000')
        const res = await fetch(`/api/admin/assets/r2?${params.toString()}`, {
          headers,
          credentials: 'include',
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(await res.text())
        const json = (await res.json()) as { objects: R2ExplorerObject[]; truncated: boolean }
        setObjects(json.objects)
        setNextCursor(null)
        setTruncated(Boolean(json.truncated))
        setPrefixes([])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
      } finally {
        setIsLoading(false)
      }
    }, 300)
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchQuery, currentPrefix, authHeaders, fetchObjects])

  const loadMore = useCallback(() => {
    if (!nextCursor || isLoading || truncated) return
    void fetchObjects(currentPrefix, nextCursor, null)
  }, [nextCursor, isLoading, truncated, currentPrefix, fetchObjects])

  const toggleSelect = useCallback((key: string) => {
    setSelectedKeys((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedKeys(new Set()), [])

  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(objects.map((object) => object.key)))
  }, [objects])

  const deleteSelected = useCallback(async () => {
    if (selectedKeys.size === 0) return
    const keys = [...selectedKeys]
    setIsLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/admin/assets/r2/batch', {
        method: 'DELETE',
        headers,
        credentials: 'include',
        body: JSON.stringify({ keys }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSelectedKeys(new Set())
      void fetchObjects(currentPrefix, null, null)
      void fetchPrefixes(currentPrefix)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsLoading(false)
    }
  }, [selectedKeys, currentPrefix, authHeaders, fetchObjects, fetchPrefixes])

  return {
    currentPrefix,
    breadcrumb,
    objects,
    prefixes,
    view,
    setView,
    searchQuery,
    setSearchQuery,
    isLoading,
    truncated,
    nextCursor,
    selectedKeys,
    toggleSelect,
    clearSelection,
    selectAll,
    loadMore,
    navigateToPrefix,
    goUp,
    deleteSelected,
    formatBytes,
    error,
  }
}
