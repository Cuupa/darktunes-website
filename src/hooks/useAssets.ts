import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import * as assetsApi from '@/lib/api/assets'
import type { Asset } from '@/types'
import type { Database } from '@/types/database'

type AssetInsert = Database['public']['Tables']['assets']['Insert']

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([])
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
      const data = await assetsApi.getAssets(supabase)
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setAssets([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createAssetRecord = async (data: AssetInsert): Promise<void> => {
    await assetsApi.createAssetRecord(supabase, data)
    await load()
  }

  const deleteAssetRecord = async (id: string): Promise<void> => {
    await assetsApi.deleteAssetRecord(supabase, id)
    await load()
  }

  useEffect(() => {
    void load()
  }, [load])

  return { assets, isLoading, error, createAssetRecord, deleteAssetRecord, reload: load }
}
