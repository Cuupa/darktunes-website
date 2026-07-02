'use client'

import { Bell } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { PopoverTrigger } from '@/components/ui/popover'

interface NotificationBellTriggerProps {
  unreadCount: number
  ariaLabel: string
}

export function NotificationBellTrigger({ unreadCount, ariaLabel }: NotificationBellTriggerProps) {
  return (
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="icon"
        className="relative min-h-[44px] min-w-[44px]"
        aria-label={ariaLabel}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
    </PopoverTrigger>
  )
}