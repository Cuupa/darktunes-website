'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface NotificationPanelProps {
  title: string
  emptyLabel: string
  markAllLabel?: string
  markAllAriaLabel?: string
  onMarkAll?: () => void
  markAllDisabled?: boolean
  footer?: ReactNode
  children: ReactNode
  isEmpty: boolean
}

export function NotificationPanel({
  title,
  emptyLabel,
  markAllLabel,
  markAllAriaLabel,
  onMarkAll,
  markAllDisabled = false,
  footer,
  children,
  isEmpty,
}: NotificationPanelProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-sm font-semibold">{title}</p>
        {markAllLabel && onMarkAll && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            onClick={onMarkAll}
            disabled={markAllDisabled}
            aria-label={markAllAriaLabel ?? markAllLabel}
          >
            {markAllLabel}
          </Button>
        )}
      </div>

      {isEmpty ? (
        <p className="px-1 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div
          className="max-h-[min(70vh,420px)] space-y-1 overflow-y-auto overscroll-contain"
          aria-live="polite"
        >
          {children}
        </div>
      )}

      {footer}
    </div>
  )
}