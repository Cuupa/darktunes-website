'use client'

/**
 * Portal-wide notification provider: Realtime toasts + reactive badge counts.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type LabelMessageRow = Database['public']['Tables']['label_messages']['Row']
type PortalMessageRow = Database['public']['Tables']['portal_messages']['Row']

export interface PortalBadgeCounts {
  messages: number
  interviews: number
  statements: number
}

interface PortalNotificationContextValue {
  badges: PortalBadgeCounts
  unreadCount: number
  setUnreadCount: (count: number | ((current: number) => number)) => void
  setBadges: (badges: PortalBadgeCounts | ((current: PortalBadgeCounts) => PortalBadgeCounts)) => void
}

export const PortalNotificationContext = createContext<PortalNotificationContextValue>({
  badges: { messages: 0, interviews: 0, statements: 0 },
  unreadCount: 0,
  setUnreadCount: () => {},
  setBadges: () => {},
})

export function useUnreadMessages() {
  const ctx = useContext(PortalNotificationContext)
  return {
    unreadCount: ctx.unreadCount,
    setUnreadCount: ctx.setUnreadCount,
    badges: ctx.badges,
    setBadges: ctx.setBadges,
  }
}

interface PortalNotificationProviderProps {
  artistId: string | null
  initialBadges: PortalBadgeCounts
  children: React.ReactNode
}

export function PortalNotificationProvider({
  artistId,
  initialBadges,
  children,
}: PortalNotificationProviderProps) {
  const [badges, setBadges] = useState(initialBadges)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const setUnreadCount = (count: number | ((current: number) => number)) => {
    setBadges((current) => {
      const nextMessages = typeof count === 'function' ? count(current.messages) : count
      return { ...current, messages: nextMessages }
    })
  }

  useEffect(() => {
    if (!artistId) return

    let isMounted = true

    const channel = supabase
      .channel(`portal-notifications-${artistId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'label_messages',
          filter: `artist_id=eq.${artistId}`,
        },
        (payload: RealtimePostgresInsertPayload<LabelMessageRow>) => {
          if (!isMounted) return
          const subject = payload.new?.subject ?? 'New message'
          setBadges((current) => ({ ...current, messages: current.messages + 1 }))
          toast.info(subject, {
            description: (
              <Link href="/portal/messages" className="underline text-primary text-sm">
                View in Messages →
              </Link>
            ),
            duration: 8000,
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'portal_messages',
          filter: `to_artist_id=eq.${artistId}`,
        },
        (payload: RealtimePostgresInsertPayload<PortalMessageRow>) => {
          if (!isMounted) return
          const subject = payload.new?.subject ?? 'New message'
          setBadges((current) => ({ ...current, messages: current.messages + 1 }))
          toast.info(subject, {
            description: (
              <Link href="/portal/messages" className="underline text-primary text-sm">
                View in Messages →
              </Link>
            ),
            duration: 8000,
          })
        },
      )
      .subscribe()

    return () => {
      isMounted = false
      void supabase.removeChannel(channel)
    }
  }, [artistId, supabase])

  const value = useMemo(
    () => ({
      badges,
      unreadCount: badges.messages,
      setUnreadCount,
      setBadges,
    }),
    [badges],
  )

  return (
    <PortalNotificationContext.Provider value={value}>
      {children}
    </PortalNotificationContext.Provider>
  )
}