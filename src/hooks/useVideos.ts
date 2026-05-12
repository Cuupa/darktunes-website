import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/env'
import * as videosApi from '@/lib/api/videos'
import type { Video } from '@/types'
import type { Database } from '@/types/database'

type VideoInsert = Database['public']['Tables']['videos']['Insert']
type VideoUpdate = Database['public']['Tables']['videos']['Update']

export function useVideos() {
  const [videos, setVideos] = useState<Video[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await videosApi.getVideos(supabase)
      setVideos(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setVideos([])
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  const createVideo = async (data: VideoInsert): Promise<void> => {
    await videosApi.createVideo(supabase, data)
    await load()
  }

  const updateVideo = async (id: string, data: VideoUpdate): Promise<void> => {
    await videosApi.updateVideo(supabase, id, data)
    await load()
  }

  const deleteVideo = async (id: string): Promise<void> => {
    await videosApi.deleteVideo(supabase, id)
    await load()
  }

  const syncYouTube = async (): Promise<{ synced: number }> => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')

    const res = await fetch('/api/sync-youtube', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`YouTube sync failed: ${text}`)
    }
    const result = (await res.json()) as { synced: number; message?: string }
    await load()
    return { synced: result.synced ?? 0 }
  }

  useEffect(() => {
    void load()
  }, [load])

  return { videos, isLoading, error, createVideo, updateVideo, deleteVideo, syncYouTube, reload: load }
}
