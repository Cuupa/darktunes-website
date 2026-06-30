'use client'

import { useTranslations } from 'next-intl'
import { Check, CircleNotch, WarningCircle } from '@phosphor-icons/react'
import type { FanPageSaveStatus as SaveStatus } from '@/hooks/useFanPageAutosave'
import { cn } from '@/lib/utils'

interface FanPageSaveStatusProps {
  status: SaveStatus
  isDirty: boolean
  className?: string
}

export function FanPageSaveStatus({ status, isDirty, className }: FanPageSaveStatusProps) {
  const t = useTranslations('portal')

  const label =
    status === 'saving' || status === 'pending'
      ? t('fanPage_save_status_saving')
      : status === 'saved'
        ? t('fanPage_save_status_saved')
        : status === 'error'
          ? t('fanPage_save_status_error')
          : isDirty
            ? t('fanPage_save_status_pending')
            : t('fanPage_save_status_idle')

  const Icon =
    status === 'saving' || status === 'pending'
      ? CircleNotch
      : status === 'saved'
        ? Check
        : status === 'error'
          ? WarningCircle
          : null

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs text-muted-foreground',
        status === 'error' && 'text-destructive',
        status === 'saved' && 'text-emerald-600 dark:text-emerald-400',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {Icon ? (
        <Icon
          size={14}
          aria-hidden
          className={cn(
            (status === 'saving' || status === 'pending') && 'animate-spin',
          )}
        />
      ) : (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
      )}
      <span>{label}</span>
    </div>
  )
}