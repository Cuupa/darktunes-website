'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { EditorNotification } from '@/types'

interface EditorNotificationBellProps {
  userId: string
}

function rowToNotification(
  row: {
    id: string
    recipient_id: string
    type: string
    entity_type: string
    entity_id: string
    entity_name: string | null
    sender_id: string | null
    read: boolean
    created_at: string
  },
): EditorNotification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    type: row.type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityName: row.entity_name ?? undefined,
    senderId: row.sender_id,
    read: row.read,
    createdAt: row.created_at,
  }
}

export function EditorNotificationBell({ userId }: EditorNotificationBellProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<EditorNotification[]>([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('editor_notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)
      setItems((data ?? []).map(rowToNotification))
    }
    void load()
  }, [supabase, userId])

  useEffect(() => {
    if (!open) return
    const unreadIds = items.filter((item) => !item.read).map((item) => item.id)
    if (unreadIds.length === 0) return

    void supabase.from('editor_notifications').update({ read: true }).in('id', unreadIds)
    setItems((prev) => prev.map((item) => ({ ...item, read: true })))
  }, [items, open, supabase])

  const unreadCount = items.filter((item) => !item.read).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative min-h-[44px] min-w-[44px]" aria-label="Open editor notifications">
          <Bell size={18} aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Notifications</p>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-2 text-sm">
                <p className="font-medium">{item.entityName ?? item.entityType}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
