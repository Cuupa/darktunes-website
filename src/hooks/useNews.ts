import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import * as newsApi from '@/lib/api/news'
import type { NewsPost } from '@/types'
import type { Database } from '@/types/database'

type NewsInsert = Database['public']['Tables']['news_posts']['Insert']
type NewsUpdate = Database['public']['Tables']['news_posts']['Update']

export function useNews() {
  const [news, setNews] = useState<NewsPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await newsApi.getNewsPosts(supabase)
      setNews(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setNews([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createNewsPost = async (data: NewsInsert): Promise<void> => {
    await newsApi.createNewsPost(supabase, data)
    await load()
  }

  const updateNewsPost = async (id: string, data: NewsUpdate): Promise<void> => {
    await newsApi.updateNewsPost(supabase, id, data)
    await load()
  }

  const deleteNewsPost = async (id: string): Promise<void> => {
    await newsApi.deleteNewsPost(supabase, id)
    await load()
  }

  useEffect(() => {
    void load()
  }, [load])

  return { news, isLoading, error, createNewsPost, updateNewsPost, deleteNewsPost, reload: load }
}
