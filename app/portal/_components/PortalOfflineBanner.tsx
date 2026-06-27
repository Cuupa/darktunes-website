'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { CloudSlash } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePortalOffline } from './PortalOfflineProvider'
import { isPortalOfflineRoute } from '@/lib/offline/portalRoutes'

export function PortalOfflineBanner() {
  const t = useTranslations('portal')
  const pathname = usePathname()
  const { offline } = usePortalOffline()

  if (!offline) return null
  if (pathname.startsWith('/portal/tour-planner')) return null

  const onOfflineCapablePage = isPortalOfflineRoute(pathname)

  return (
    <div
      className="mb-6 flex flex-wrap items-start gap-3 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm"
      role="status"
      aria-live="polite"
    >
      <CloudSlash size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="space-y-1 min-w-0">
        <p className="font-medium">{t('portal_offline_heading')}</p>
        <p className="text-muted-foreground">
          {onOfflineCapablePage ? t('portal_offline_limited') : t('portal_offline_blocked')}
        </p>
        {!pathname.startsWith('/portal/tour-planner') && (
          <Link href="/portal/tour-planner" className="text-primary hover:underline text-sm font-medium">
            {t('portal_offline_open_tour_planner')}
          </Link>
        )}
      </div>
    </div>
  )
}