import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import * as videosApi from '@/lib/api/videos'
import type { Video } from '@/types'
import type { Database } from '@/types/database'

type VideoInsert = Database['public']['Tables']['videos']['Insert']
type VideoUpdate = Database['public']['Tables']['videos']['Update']

export function useVideos() {
  const [videos, setVideos] = useState<Video[]>([])
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
      const data = await videosApi.getVideos(supabase)
      setVideos(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setVideos([])
    } finally {
      setIsLoading(false)
    }
  }, [])

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

  useEffect(() => {
    void load()
  }, [load])

  return { videos, isLoading, error, createVideo, updateVideo, deleteVideo, reload: load }
}
