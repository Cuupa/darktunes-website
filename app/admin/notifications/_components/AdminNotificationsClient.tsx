'use client'

import { useTranslations } from 'next-intl'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'

interface AdminNotificationsClientProps {
  userId: string
  role: string
}

export function AdminNotificationsClient({ userId, role }: AdminNotificationsClientProps) {
  const t = useTranslations('admin.notifications')

  return (
    <NotificationCenter
      userId={userId}
      role={role}
      title={t('centerTitle')}
      description={t('centerDescription')}
      emptyLabel={t('empty')}
      markAllLabel={t('markAll')}
      filterAllLabel={t('filterAll')}
      filterUnreadLabel={t('filterUnread')}
      loadMoreLabel={t('loadMore')}
      preferencesHref="/admin/notifications/preferences"
      preferencesLabel={t('preferencesLink')}
    />
  )
}
