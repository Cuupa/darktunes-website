'use client'

import { useCallback, useMemo, useState } from 'react'
import { useKV } from '@/hooks/useLocalKV'
import { DEFAULT_CSV_PROFILES } from '@/lib/sos/ingest/default-profiles'
import type { CsvImportProfile } from '@/lib/sos/ingest/types'

const STORAGE_KEY = 'darktunes_csv_import_profiles'

export function useCsvImportProfiles() {
  const [customProfiles, setCustomProfiles] = useKV<CsvImportProfile[]>(STORAGE_KEY, [])

  const profiles = useMemo(
    () => [...DEFAULT_CSV_PROFILES, ...(customProfiles ?? [])],
    [customProfiles],
  )

  const saveProfile = useCallback(
    (profile: CsvImportProfile) => {
      setCustomProfiles((prev) => {
        const list = prev ?? []
        const idx = list.findIndex((p) => p.id === profile.id)
        if (idx >= 0) {
          const next = [...list]
          next[idx] = profile
          return next
        }
        return [...list, profile]
      })
    },
    [setCustomProfiles],
  )

  const deleteProfile = useCallback(
    (id: string) => {
      setCustomProfiles((prev) => (prev ?? []).filter((p) => p.id !== id))
    },
    [setCustomProfiles],
  )

  const [editorOpen, setEditorOpen] = useState(false)

  return {
    profiles,
    customProfiles: customProfiles ?? [],
    saveProfile,
    deleteProfile,
    editorOpen,
    setEditorOpen,
  }
}