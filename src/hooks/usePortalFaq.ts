'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/env'
import type { PortalFaqCategory, PortalFaqItem, PortalFaqTree } from '@/types'

async function parseApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string }
    return data.error ?? data.message ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

export function usePortalFaq() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [categories, setCategories] = useState<PortalFaqCategory[]>([])
  const [items, setItems] = useState<PortalFaqItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    return session.access_token
  }, [supabase])

  const revalidateFaqCache = useCallback(async () => {
    try {
      const token = await getToken()
      void fetch('/api/revalidate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tags: ['portal-faq'] }),
      })
    } catch {
      // Non-critical
    }
  }, [getToken])

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const headers = { Authorization: `Bearer ${token}` }
      const [catRes, itemRes] = await Promise.all([
        fetch('/api/admin/portal-faq/categories', { headers }),
        fetch('/api/admin/portal-faq/items', { headers }),
      ])
      if (!catRes.ok) throw new Error(await parseApiError(catRes))
      if (!itemRes.ok) throw new Error(await parseApiError(itemRes))
      setCategories((await catRes.json()) as PortalFaqCategory[])
      setItems((await itemRes.json()) as PortalFaqItem[])
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    void load()
  }, [load])

  const tree = useMemo((): PortalFaqTree[] => {
    const byCategory = new Map<string, PortalFaqItem[]>()
    for (const item of items) {
      const list = byCategory.get(item.categoryId) ?? []
      list.push(item)
      byCategory.set(item.categoryId, list)
    }
    return categories
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => ({
        category,
        items: (byCategory.get(category.id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
      }))
  }, [categories, items])

  const saveCategory = async (payload: {
    id?: string
    slug: string
    titleEn: string
    titleDe?: string | null
    sortOrder?: number
    isPublished?: boolean
  }) => {
    const token = await getToken()
    const res = await fetch('/api/admin/portal-faq/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: payload.id,
        slug: payload.slug,
        title_en: payload.titleEn,
        title_de: payload.titleDe ?? null,
        sort_order: payload.sortOrder ?? 0,
        is_published: payload.isPublished ?? true,
      }),
    })
    if (!res.ok) throw new Error(await parseApiError(res))
    await load()
    void revalidateFaqCache()
  }

  const patchCategory = async (
    id: string,
    patch: Partial<{
      slug: string
      titleEn: string
      titleDe: string | null
      sortOrder: number
      isPublished: boolean
    }>,
  ) => {
    const token = await getToken()
    const res = await fetch(`/api/admin/portal-faq/categories/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        slug: patch.slug,
        title_en: patch.titleEn,
        title_de: patch.titleDe,
        sort_order: patch.sortOrder,
        is_published: patch.isPublished,
      }),
    })
    if (!res.ok) throw new Error(await parseApiError(res))
    await load()
    void revalidateFaqCache()
  }

  const removeCategory = async (id: string) => {
    const token = await getToken()
    const res = await fetch(`/api/admin/portal-faq/categories/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(await parseApiError(res))
    await load()
    void revalidateFaqCache()
  }

  const saveItem = async (payload: {
    id?: string
    categoryId: string
    slug: string
    questionEn: string
    questionDe?: string | null
    answerHtmlEn: string
    answerHtmlDe?: string | null
    keywords?: string[]
    portalRoute?: string | null
    sortOrder?: number
    isPublished?: boolean
  }) => {
    const token = await getToken()
    const res = await fetch('/api/admin/portal-faq/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: payload.id,
        category_id: payload.categoryId,
        slug: payload.slug,
        question_en: payload.questionEn,
        question_de: payload.questionDe ?? null,
        answer_html_en: payload.answerHtmlEn,
        answer_html_de: payload.answerHtmlDe ?? null,
        keywords: payload.keywords ?? [],
        portal_route: payload.portalRoute ?? null,
        sort_order: payload.sortOrder ?? 0,
        is_published: payload.isPublished ?? true,
      }),
    })
    if (!res.ok) throw new Error(await parseApiError(res))
    await load()
    void revalidateFaqCache()
  }

  const patchItem = async (
    id: string,
    patch: Partial<{
      categoryId: string
      slug: string
      questionEn: string
      questionDe: string | null
      answerHtmlEn: string
      answerHtmlDe: string | null
      keywords: string[]
      portalRoute: string | null
      sortOrder: number
      isPublished: boolean
    }>,
  ) => {
    const token = await getToken()
    const res = await fetch(`/api/admin/portal-faq/items/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        category_id: patch.categoryId,
        slug: patch.slug,
        question_en: patch.questionEn,
        question_de: patch.questionDe,
        answer_html_en: patch.answerHtmlEn,
        answer_html_de: patch.answerHtmlDe,
        keywords: patch.keywords,
        portal_route: patch.portalRoute,
        sort_order: patch.sortOrder,
        is_published: patch.isPublished,
      }),
    })
    if (!res.ok) throw new Error(await parseApiError(res))
    await load()
    void revalidateFaqCache()
  }

  const removeItem = async (id: string) => {
    const token = await getToken()
    const res = await fetch(`/api/admin/portal-faq/items/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(await parseApiError(res))
    await load()
    void revalidateFaqCache()
  }

  return {
    categories,
    items,
    tree,
    isLoading,
    error,
    reload: load,
    saveCategory,
    patchCategory,
    removeCategory,
    saveItem,
    patchItem,
    removeItem,
  }
}