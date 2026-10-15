'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getIncomingToLabelUnreadCount } from '@/lib/api/portalMessages'
import { safeCount } from '@/lib/api/safeCount'

export type AdminBadgeKey =
  | 'messages'
  | 'releaseSubmissions'
  | 'videoSubmissions'
  | 'fanPageReviews'
  | 'portalFeedback'

export type AdminNavBadges = Record<AdminBadgeKey, number>

export const EMPTY_ADMIN_NAV_BADGES: AdminNavBadges = {
  messages: 0,
  releaseSubmissions: 0,
  videoSubmissions: 0,
  fanPageReviews: 0,
  portalFeedback: 0,
}

/**
 * Live admin nav badge counts (portal inbox, submissions, feedback).
 *
 * Supabase Realtime forbids adding `postgres_changes` after `subscribe()`. The browser
 * client is a singleton, so:
 * - Channel topics must be unique per hook instance (`useId`) when multiple trees mount.
 * - Prefer a single mount via `AdminNavBadgesProvider` (admin layout) so sidebar + push
 *   badge share one subscription set.
 * - Keep `refresh` out of the subscribe effect deps (ref) so identity churn does not
 *   re-subscribe onto a channel still leaving the client registry.
 */
export function useAdminNavBadges(_userId: string | null, enabled: boolean) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const instanceId = useId().replace(/:/g, '')
  const [badges, setBadges] = useState<AdminNavBadges>(EMPTY_ADMIN_NAV_BADGES)

  const refresh = useCallback(async () => {
    if (!enabled) return

    const [portalUnread, releasePending, videoPending, fanPagePending, feedbackNew] =
      await Promise.all([
        getIncomingToLabelUnreadCount(supabase).catch(() => 0),
        safeCount(
          supabase
            .from('release_submissions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'received'),
        ),
        safeCount(
          supabase
            .from('video_submissions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'received'),
        ),
        safeCount(
          supabase
            .from('artist_landing_pages')
            .select('id', { count: 'exact', head: true })
            .eq('publish_status', 'pending_review'),
        ),
        safeCount(
          supabase
            .from('portal_feedback')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'new'),
        ),
      ])

    setBadges({
      messages: portalUnread,
      releaseSubmissions: releasePending,
      videoSubmissions: videoPending,
      fanPageReviews: fanPagePending,
      portalFeedback: feedbackNew,
    })
  }, [enabled, supabase])

  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  // Realtime writes often arrive in bursts (a submission plus its notification).
  // Coalesce them so one change does not fire six count queries per event.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      void refreshRef.current()
    }, 800)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!enabled) return

    const onChange = () => {
      scheduleRefresh()
    }

    // Unique topics per instance: singleton client returns an already-subscribed
    // channel when the topic collides (Strict Mode remount / dual consumers).
    const portalChannel = supabase
      .channel(`admin-nav-portal-messages-${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'portal_messages', filter: 'to_label=eq.true' },
        onChange,
      )
      .subscribe()

    const submissionChannel = supabase
      .channel(`admin-nav-submissions-${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'release_submissions' },
        onChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'video_submissions' },
        onChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'artist_landing_pages' },
        onChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'portal_feedback' },
        onChange,
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(portalChannel)
      void supabase.removeChannel(submissionChannel)
    }
  }, [enabled, instanceId, scheduleRefresh, supabase])

  return badges
}
