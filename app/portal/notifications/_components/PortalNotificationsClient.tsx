'use client'

import { useTranslations } from 'next-intl'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'

interface Props {
  userId: string
  artistId: string | null
}

export function PortalNotificationsClient({ userId, artistId }: Props) {
  const t = useTranslations('portal')
  const prefsHref = artistId
    ? `/portal/notifications/preferences?artistId=${artistId}`
    : '/portal/notifications/preferences'

  return (
    <NotificationCenter
      userId={userId}
      role="artist"
      artistId={artistId}
      title={t('notifications_center_title')}
      description={t('notifications_center_desc')}
      emptyLabel={t('notifications_empty')}
      markAllLabel={t('notifications_markAllMessages')}
      filterAllLabel={t('notifications_filter_all')}
      filterUnreadLabel={t('notifications_filter_unread')}
      loadMoreLabel={t('notifications_load_more')}
      preferencesHref={prefsHref}
      preferencesLabel={t('notifications_preferences_link')}
    />
  )
}
