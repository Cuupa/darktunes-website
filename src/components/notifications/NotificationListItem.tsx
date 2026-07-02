'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface NotificationListItemProps {
  href?: string | null
  title: string
  timeLabel: string
  actionLabel?: string
  isUnread: boolean
  onClick?: () => void
}

export function NotificationListItem({
  href,
  title,
  timeLabel,
  actionLabel,
  isUnread,
  onClick,
}: NotificationListItemProps) {
  const className = cn(
    'block rounded-md border border-border p-2 text-sm transition-colors',
    'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isUnread && 'bg-primary/10',
  )

  const content = (
    <div className="flex gap-2">
      <span
        className={cn(
          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
          isUnread ? 'bg-primary' : 'bg-transparent',
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium', isUnread && 'text-foreground')}>{title}</p>
        <p className="text-xs text-muted-foreground">{timeLabel}</p>
        {actionLabel && <p className="text-xs font-medium text-primary">{actionLabel}</p>}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <div className={className}>
      {content}
    </div>
  )
}