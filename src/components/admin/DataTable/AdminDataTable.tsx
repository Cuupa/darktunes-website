import { Fragment, type ReactNode } from 'react'
import { flexRender } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Row, Table as TanStackTable } from './types'

type AdminDataTableProps<TData> = {
  table: TanStackTable<TData>
  loading?: boolean
  emptyMessage?: string
  skeletonRowCount?: number
  renderSubRow?: (row: Row<TData>) => ReactNode
  getRowClassName?: (row: Row<TData>) => string | undefined
  className?: string
  stickyHeader?: boolean
}

export function AdminDataTable<TData>({
  table,
  loading = false,
  emptyMessage = 'No entries found.',
  skeletonRowCount = 5,
  renderSubRow,
  getRowClassName,
  className,
  stickyHeader = false,
}: AdminDataTableProps<TData>) {
  const columnCount = table.getAllColumns().length
  const rows = table.getRowModel().rows

  return (
    <div className={cn('overflow-x-auto overscroll-contain', className)} data-lenis-prevent>
      <Table>
        <TableHeader
          className={cn(
            stickyHeader && 'sticky top-0 z-10 border-b border-border bg-card',
          )}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className={stickyHeader ? 'bg-card hover:bg-card' : undefined}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className={stickyHeader ? 'bg-card' : undefined}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
              <TableRow key={`skeleton-${rowIndex}`}>
                {Array.from({ length: columnCount }).map((__, colIndex) => (
                  <TableCell key={`skeleton-${rowIndex}-${colIndex}`}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="text-center text-muted-foreground py-8">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <Fragment key={row.id}>
                <TableRow
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className={getRowClassName?.(row)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {renderSubRow?.(row)}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}