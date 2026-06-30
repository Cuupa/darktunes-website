'use client'

import Link from 'next/link'
import { Bell } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useUnreadMessages } from '@/contexts/PortalNotificationProvider'

export function PortalNotificationBell() {
  const { badges } = useUnreadMessages()
  const total = badges.messages + badges.interviews + badges.statements
  const ariaLabel = total > 0 ? `Open portal notifications, ${total} unread` : 'Open portal notifications'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative min-h-[44px] min-w-[44px]"
          aria-label={ariaLabel}
        >
          <Bell size={18} aria-hidden="true" />
          {total > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {total > 9 ? '9+' : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="mb-2 text-sm font-semibold">Notifications</p>
        <div className="space-y-1 text-sm">
          <Link href="/portal/messages" className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50">
            <span>Messages</span>
            {badges.messages > 0 && <span className="text-primary">{badges.messages}</span>}
          </Link>
          <Link href="/portal/interviews" className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50">
            <span>Interviews</span>
            {badges.interviews > 0 && <span className="text-primary">{badges.interviews}</span>}
          </Link>
          <Link href="/portal/statements" className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50">
            <span>Statements</span>
            {badges.statements > 0 && <span className="text-primary">{badges.statements}</span>}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}