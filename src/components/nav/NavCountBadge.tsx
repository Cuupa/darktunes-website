'use client'

import { cn } from '@/lib/utils'

interface NavCountBadgeProps {
  count: number
  className?: string
  label?: string
}

export function NavCountBadge({ count, className, label }: NavCountBadgeProps) {
  if (count <= 0) return null

  const display = count > 9 ? '9+' : String(count)

  return (
    <span
      className={cn(
        'ml-auto inline-flex min-w-[20px] justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground',
        className,
      )}
      aria-label={label ?? `${count} unread`}
    >
      {display}
    </span>
  )
}