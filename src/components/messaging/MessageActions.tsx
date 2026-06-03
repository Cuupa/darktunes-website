'use client'

import { DotsThreeOutlineVertical, Export, Star, StarFour, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface MessageActionsProps {
  messageId: string
  starred: boolean
  deletedAt: string | null
  onStar: (id: string, starred: boolean) => void
  onDelete: (id: string) => void
  onExport: (id: string) => void
}

export function MessageActions({ messageId, starred, deletedAt, onStar, onDelete, onExport }: MessageActionsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" aria-label="Message actions">
          <DotsThreeOutlineVertical size={18} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-2">
        <div className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] w-full justify-start gap-2"
            onClick={() => onStar(messageId, !starred)}
          >
            {starred ? <StarFour size={18} aria-hidden="true" style={{ color: 'var(--primary)' }} /> : <Star size={18} aria-hidden="true" />}
            {starred ? 'Unstar' : 'Star'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] w-full justify-start gap-2"
            onClick={() => onExport(messageId)}
          >
            <Export size={18} aria-hidden="true" />
            Export
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] w-full justify-start gap-2 text-destructive hover:text-destructive"
            disabled={deletedAt !== null}
            onClick={() => onDelete(messageId)}
          >
            <Trash size={18} aria-hidden="true" />
            {deletedAt ? 'Deleted' : 'Delete'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
