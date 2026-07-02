'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/contexts/AuthContext'
import type { DashboardNotification } from '@/types'
import {
  getDashboardNotificationActionLabel,
  getDashboardNotificationHref,
  getDashboardNotificationSummary,
} from '@/lib/admin/dashboardNotificationRouting'
import {
  getEditorNotifications,
  getEditorUnreadCount,
  markAllEditorNotificationsRead,
  markEditorNotificationRead,
} from '@/lib/api/editorNotifications'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import { NotificationBellTrigger } from '@/components/notifications/NotificationBellTrigger'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { NotificationListItem } from '@/components/notifications/NotificationListItem'

interface DashboardNotificationBellProps {
  userId: string
}

export function DashboardNotificationBell({ userId }: DashboardNotificationBellProps) {
  const t = useTranslations('admin.notifications')
  const locale = useLocale()
  const { profile } = useAuthContext()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const channelInstanceId = useId().replace(/:/g, '')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<DashboardNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [markingAll, setMarkingAll] = useState(false)

  const loadNotifications = useCallback(async () => {
    const [notifications, count] = await Promise.all([
      getEditorNotifications(supabase, userId),
      getEditorUnreadCount(supabase, userId),
    ])
    setItems(notifications)
    setUnreadCount(count)
  }, [supabase, userId])

  const loadNotificationsRef = useRef(loadNotifications)
  loadNotificationsRef.current = loadNotifications

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-notifications-${userId}-${channelInstanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'editor_notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => { void loadNotificationsRef.current() },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'editor_notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => { void loadNotificationsRef.current() },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [channelInstanceId, supabase, userId])

  useEffect(() => {
    if (!open) return
    void loadNotifications()
  }, [loadNotifications, open])

  const handleItemClick = useCallback(async (item: DashboardNotification) => {
    if (item.read) return

    setItems((prev) =>
      prev.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)),
    )
    setUnreadCount((count) => Math.max(0, count - 1))

    try {
      await markEditorNotificationRead(supabase, item.id)
      const count = await getEditorUnreadCount(supabase, userId)
      setUnreadCount(count)
    } catch {
      void loadNotifications()
    }
  }, [loadNotifications, supabase, userId])

  const handleMarkAll = useCallback(async () => {
    if (unreadCount === 0 || markingAll) return

    setMarkingAll(true)
    setItems((prev) => prev.map((item) => ({ ...item, read: true })))
    setUnreadCount(0)

    try {
      await markAllEditorNotificationsRead(supabase, userId)
      const count = await getEditorUnreadCount(supabase, userId)
      setUnreadCount(count)
      await loadNotifications()
    } catch {
      void loadNotifications()
    } finally {
      setMarkingAll(false)
    }
  }, [loadNotifications, markingAll, supabase, unreadCount, userId])

  const ariaLabel =
    unreadCount > 0
      ? t('unreadAria', { count: unreadCount })
      : t('openAria')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <NotificationBellTrigger unreadCount={unreadCount} ariaLabel={ariaLabel} />
      <PopoverContent align="end" className="w-80 p-2">
        <NotificationPanel
          title={t('title')}
          emptyLabel={t('empty')}
          markAllLabel={t('markAll')}
          markAllAriaLabel={t('markAllAria')}
          onMarkAll={handleMarkAll}
          markAllDisabled={unreadCount === 0 || markingAll}
          isEmpty={items.length === 0}
        >
          {items.map((item) => {
            const href = getDashboardNotificationHref(item, profile?.role)
            const summary = getDashboardNotificationSummary(item)
            const actionLabel = getDashboardNotificationActionLabel(item.type)

            return (
              <NotificationListItem
                key={item.id}
                href={href}
                title={summary}
                timeLabel={formatRelativeTime(item.createdAt, locale)}
                actionLabel={href ? actionLabel : undefined}
                isUnread={!item.read}
                onClick={() => {
                  void handleItemClick(item)
                  setOpen(false)
                }}
              />
            )
          })}
        </NotificationPanel>
      </PopoverContent>
    </Popover>
  )
}