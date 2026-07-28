'use client'

import { useTranslations } from 'next-intl'
import { NotificationPreferencesForm } from '@/components/notifications/NotificationPreferencesForm'
import { ALL_NOTIFICATION_EVENT_TYPES } from '@/lib/notifications'

interface Props {
  userId: string
}

export function AdminNotificationPreferencesClient({ userId }: Props) {
  const t = useTranslations('admin.notifications')

  const typeLabels: Record<string, string> = {}
  for (const type of ALL_NOTIFICATION_EVENT_TYPES) {
    const key = `typeLabels.${type}` as Parameters<typeof t>[0]
    try {
      typeLabels[type] = t(key)
    } catch {
      typeLabels[type] = type
    }
  }

  return (
    <NotificationPreferencesForm
      userId={userId}
      title={t('preferencesTitle')}
      description={t('preferencesDescription')}
      saveLabel={t('preferencesSave')}
      savedLabel={t('preferencesSaved')}
      inAppLabel={t('channelInApp')}
      emailLabel={t('channelEmail')}
      typeLabels={typeLabels}
    />
  )
}
