'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/contexts/AuthContext'
import type { EditorNotification } from '@/types'
import {
  getEditorNotificationActionLabel,
  getEditorNotificationHref,
  getEditorNotificationSummary,
} from '@/lib/admin/editorNotificationRouting'

interface EditorNotificationBellProps {
  userId: string
}

function rowToNotification(
  row: {
    id: string
    recipient_id: string
    type: string
    entity_type: string
    entity_id: string
    entity_name: string | null
    sender_id: string | null
    read: boolean
    created_at: string
  },
): EditorNotification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    type: row.type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityName: row.entity_name ?? undefined,
    senderId: row.sender_id,
    read: row.read,
    createdAt: row.created_at,
  }
}

export function EditorNotificationBell({ userId }: EditorNotificationBellProps) {
  const { profile } = useAuthContext()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<EditorNotification[]>([])

  const [unreadCount, setUnreadCount] = useState(0)

  const loadNotifications = useCallback(async () => {
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from('editor_notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('editor_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('read', false),
    ])
    setItems((data ?? []).map(rowToNotification))
    setUnreadCount(count ?? 0)
  }, [supabase, userId])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    const channel = supabase
      .channel(`editor-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'editor_notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => { void loadNotifications() },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadNotifications, supabase, userId])

  useEffect(() => {
    if (!open) return
    void loadNotifications()
  }, [loadNotifications, open])

  useEffect(() => {
    if (!open) return
    const unreadIds = items.filter((item) => !item.read).map((item) => item.id)
    if (unreadIds.length === 0) return

    void supabase.from('editor_notifications').update({ read: true }).in('id', unreadIds)
    setItems((prev) => prev.map((item) => ({ ...item, read: true })))
  }, [items, open, supabase])

  const ariaLabel =
    unreadCount > 0
      ? `Open admin notifications, ${unreadCount} unread`
      : 'Open admin notifications'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative min-h-[44px] min-w-[44px]"
          aria-label={ariaLabel}
        >
          <Bell size={18} aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Notifications</p>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            items.map((item) => {
              const href = getEditorNotificationHref(item, profile?.role)
              const summary = getEditorNotificationSummary(item)
              const actionLabel = getEditorNotificationActionLabel(item.type)

              const content = (
                <>
                  <p className="font-medium">{summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                  {href && (
                    <p className="text-xs font-medium text-primary">{actionLabel}</p>
                  )}
                </>
              )

              return href ? (
                <Link
                  key={item.id}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md border border-border p-2 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {content}
                </Link>
              ) : (
                <div key={item.id} className="rounded-md border border-border p-2 text-sm">
                  {content}
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}