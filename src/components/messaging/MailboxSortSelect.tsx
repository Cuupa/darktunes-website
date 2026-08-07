'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MailboxSortMode } from '@/lib/messaging/threads'

export interface MailboxSortSelectProps {
  value: MailboxSortMode
  onChange: (value: MailboxSortMode) => void
  'aria-label'?: string
  className?: string
}

const OPTIONS: Array<{ value: MailboxSortMode; label: string }> = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'unread_first', label: 'Unread first' },
  { value: 'subject_asc', label: 'Subject A–Z' },
  { value: 'count_desc', label: 'Most replies' },
]

export function MailboxSortSelect({
  value,
  onChange,
  'aria-label': ariaLabel = 'Sort conversations',
  className,
}: MailboxSortSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as MailboxSortMode)}>
      <SelectTrigger className={className ?? 'h-8 text-xs w-full'} aria-label={ariaLabel}>
        <SelectValue placeholder="Sort" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
