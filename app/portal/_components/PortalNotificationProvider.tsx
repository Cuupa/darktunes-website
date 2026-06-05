'use client'

/**
 * app/portal/_components/PortalNotificationProvider.tsx
 *
 * Portal-wide notification provider that subscribes to Supabase Realtime for
 * new `label_messages` events and:
 *   1. Shows a sonner toast with the message subject and a link to the inbox.
 *   2. Maintains a reactive unread count that updates without a page reload.
 *
 * The unread count is exposed via `UnreadMessagesContext` so `PortalSidebar`
 * can read the live value instead of the server-rendered initial count.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type MessageRow = Database['public']['Tables']['label_messages']['Row']

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface UnreadMessagesContextValue {
  unreadCount: number
  setUnreadCount: (count: number) => void
}

export const UnreadMessagesContext = createContext<UnreadMessagesContextValue>({
  unreadCount: 0,
  setUnreadCount: () => {},
})

export function useUnreadMessages() {
  return useContext(UnreadMessagesContext)
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface PortalNotificationProviderProps {
  artistId: string | null
  initialUnreadCount: number
  children: React.ReactNode
}

export function PortalNotificationProvider({
  artistId,
  initialUnreadCount,
  children,
}: PortalNotificationProviderProps) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

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
        (payload: RealtimePostgresInsertPayload<MessageRow>) => {
          if (!isMounted) return
          const subject = payload.new?.subject ?? 'New message'
          setUnreadCount((c) => c + 1)
          toast.info(subject, {
            description: (
              <Link
                href="/portal/messages"
                className="underline text-primary text-sm"
              >
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

  const value = useMemo(() => ({ unreadCount, setUnreadCount }), [unreadCount])

  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
    </UnreadMessagesContext.Provider>
  )
}
