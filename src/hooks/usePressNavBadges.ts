'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { safeCount } from '@/lib/api/safeCount'

export interface PressNavBadges {
  interviews: number
  accreditation: number
}

const EMPTY_BADGES: PressNavBadges = {
  interviews: 0,
  accreditation: 0,
}

export function usePressNavBadges(userId: string | null) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [badges, setBadges] = useState<PressNavBadges>(EMPTY_BADGES)

  const refresh = useCallback(async () => {
    if (!userId) return

    const [interviews, accreditation] = await Promise.all([
      safeCount(
        supabase
          .from('interview_requests')
          .select('id', { count: 'exact', head: true })
          .eq('journalist_id', userId)
          .eq('status', 'pending'),
      ),
      safeCount(
        supabase
          .from('accreditation_requests')
          .select('id', { count: 'exact', head: true })
          .eq('journalist_id', userId)
          .eq('status', 'pending'),
      ),
    ])

    setBadges({ interviews, accreditation })
  }, [supabase, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`press-nav-badges-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'interview_requests', filter: `journalist_id=eq.${userId}` },
        () => { void refresh() },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accreditation_requests', filter: `journalist_id=eq.${userId}` },
        () => { void refresh() },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refresh, supabase, userId])

  return badges
}