'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useUnreadMessages } from '@/contexts/PortalNotificationProvider'
import {
  getPortalNotificationFeed,
  markAllPortalMessagesRead,
  markPortalNotificationItemRead,
  type PortalNotificationItem,
} from '@/lib/api/portalNotifications'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import { NotificationBellTrigger } from '@/components/notifications/NotificationBellTrigger'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { NotificationListItem } from '@/components/notifications/NotificationListItem'

interface PortalNotificationBellProps {
  artistId: string | null
}

export function PortalNotificationBell({ artistId }: PortalNotificationBellProps) {
  const t = useTranslations('portal')
  const locale = useLocale()
  const { badges, setBadges } = useUnreadMessages()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<PortalNotificationItem[]>([])
  const [markingAll, setMarkingAll] = useState(false)

  const total = badges.messages + badges.interviews + badges.statements
  const ariaLabel =
    total > 0
      ? t('notifications_unreadAria', { count: total })
      : t('notifications_openAria')

  const loadFeed = useCallback(async () => {
    if (!artistId) {
      setItems([])
      return
    }

    const feed = await getPortalNotificationFeed(supabase, artistId)
    setItems(feed)
  }, [artistId, supabase])

  useEffect(() => {
    if (!open) return
    void loadFeed()
  }, [loadFeed, open])

  const handleItemClick = useCallback(async (item: PortalNotificationItem) => {
    if (!item.canMarkRead || !item.isUnread) return

    setItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id && entry.kind === item.kind
          ? { ...entry, isUnread: false }
          : entry,
      ),
    )
    setBadges((current) => ({
      ...current,
      messages: Math.max(0, current.messages - 1),
    }))

    try {
      await markPortalNotificationItemRead(supabase, item)
    } catch {
      void loadFeed()
    }
  }, [loadFeed, setBadges, supabase])

  const handleMarkAllMessages = useCallback(async () => {
    if (!artistId || badges.messages === 0 || markingAll) return

    setMarkingAll(true)
    setItems((prev) =>
      prev.map((item) =>
        item.canMarkRead ? { ...item, isUnread: false } : item,
      ),
    )
    setBadges((current) => ({ ...current, messages: 0 }))

    try {
      await markAllPortalMessagesRead(supabase, artistId)
      await loadFeed()
    } catch {
      void loadFeed()
    } finally {
      setMarkingAll(false)
    }
  }, [artistId, badges.messages, loadFeed, markingAll, setBadges, supabase])

  const messagesHref = artistId ? `/portal/messages?artistId=${artistId}` : '/portal/messages'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <NotificationBellTrigger unreadCount={total} ariaLabel={ariaLabel} />
      <PopoverContent align="end" className="w-80 p-2">
        <NotificationPanel
          title={t('notifications_title')}
          emptyLabel={t('notifications_empty')}
          markAllLabel={t('notifications_markAllMessages')}
          markAllAriaLabel={t('notifications_markAllMessagesAria')}
          onMarkAll={handleMarkAllMessages}
          markAllDisabled={badges.messages === 0 || markingAll || !artistId}
          isEmpty={items.length === 0}
          footer={
            artistId ? (
              <div className="border-t border-border px-1 pt-2">
                <Link
                  href={messagesHref}
                  onClick={() => setOpen(false)}
                  className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('notifications_viewAllMessages')}
                </Link>
              </div>
            ) : null
          }
        >
          {items.map((item) => {
            const actionLabel =
              item.kind === 'label_message' || item.kind === 'portal_message'
                ? t('notifications_viewMessage')
                : item.kind === 'interview'
                  ? t('notifications_viewInterview')
                  : item.kind === 'statement'
                    ? t('notifications_viewStatement')
                    : undefined

            return (
              <NotificationListItem
                key={`${item.kind}-${item.id}`}
                href={item.href}
                title={item.title}
                timeLabel={formatRelativeTime(item.createdAt, locale)}
                actionLabel={actionLabel}
                isUnread={item.isUnread}
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