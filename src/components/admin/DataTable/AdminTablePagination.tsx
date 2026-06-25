import { ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { ADMIN_TABLE_PAGE_SIZE } from './constants'

type AdminTablePaginationProps = {
  pageIndex: number
  totalCount: number
  pageSize?: number
  onPageChange: (pageIndex: number) => void
  entityLabel?: string
}

export function AdminTablePagination({
  pageIndex,
  totalCount,
  pageSize = ADMIN_TABLE_PAGE_SIZE,
  onPageChange,
  entityLabel = 'entries',
}: AdminTablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const singular = entityLabel.endsWith('s') ? entityLabel.slice(0, -1) : entityLabel

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        {totalCount} {totalCount === 1 ? singular : entityLabel}
        {totalPages > 1 && ` · Page ${pageIndex + 1} of ${totalPages}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          disabled={pageIndex === 0}
          onClick={() => onPageChange(pageIndex - 1)}
          aria-label="Previous page"
          className="min-w-[44px] min-h-[44px]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={pageIndex >= totalPages - 1}
          onClick={() => onPageChange(pageIndex + 1)}
          aria-label="Next page"
          className="min-w-[44px] min-h-[44px]"
        >
          <ArrowRight size={14} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}