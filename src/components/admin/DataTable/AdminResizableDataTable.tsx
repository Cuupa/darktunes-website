import { type DragEvent, type MouseEvent, useCallback, useRef } from 'react'
import { flexRender } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import type { Row, Table as TanStackTable } from './types'

type AdminResizableDataTableProps<TData> = {
  table: TanStackTable<TData>
  emptyMessage?: string
  actionsColumnId?: string
  selectColumnId?: string
  className?: string
  getRowClassName?: (row: Row<TData>) => string | undefined
}

export function AdminResizableDataTable<TData>({
  table,
  emptyMessage = 'No entries found.',
  actionsColumnId = 'actions',
  selectColumnId = 'select',
  className,
  getRowClassName,
}: AdminResizableDataTableProps<TData>) {
  const dragColRef = useRef<string | null>(null)
  const resizeRef = useRef<{ id: string; startX: number; startW: number } | null>(null)

  const onResizeMouseDown = useCallback(
    (columnId: string, currentWidth: number, event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      resizeRef.current = { id: columnId, startX: event.clientX, startW: currentWidth }

      function onMove(ev: globalThis.MouseEvent) {
        if (!resizeRef.current) return
        const column = table.getColumn(resizeRef.current.id)
        if (!column) return
        const minSize = column.columnDef.minSize ?? 60
        const newSize = Math.max(minSize, resizeRef.current.startW + ev.clientX - resizeRef.current.startX)
        table.setColumnSizing((prev) => ({ ...prev, [resizeRef.current!.id]: newSize }))
      }

      function onUp() {
        resizeRef.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [table],
  )

  const onDragStart = useCallback((columnId: string) => {
    dragColRef.current = columnId
  }, [])

  const onDragOver = useCallback(
    (event: DragEvent, columnId: string) => {
      event.preventDefault()
      if (!dragColRef.current || dragColRef.current === columnId) return
      const order = table.getState().columnOrder
      const from = order.indexOf(dragColRef.current)
      const to = order.indexOf(columnId)
      if (from === -1 || to === -1) return
      const next = [...order]
      next.splice(from, 1)
      next.splice(to, 0, dragColRef.current)
      table.setColumnOrder(next)
      dragColRef.current = columnId
    },
    [table],
  )

  const onDragEnd = useCallback(() => {
    dragColRef.current = null
  }, [])

  const rows = table.getRowModel().rows
  const leafColumns = table.getVisibleLeafColumns()
  const minWidth = leafColumns.reduce((sum, col) => sum + col.getSize(), 0)

  return (
    <div className={cn('overflow-x-auto flex-1', className)}>
      <table
        className="w-full text-sm"
        style={{ tableLayout: 'fixed', minWidth }}
      >
        <colgroup>
          {leafColumns.map((column) => (
            <col key={column.id} style={{ width: column.getSize() }} />
          ))}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-white/10 bg-white/[0.02]">
              {headerGroup.headers.map((header) => {
                const columnId = header.column.id
                const isDraggable =
                  columnId !== selectColumnId && columnId !== actionsColumnId
                const isResizable = header.column.getCanResize()
                const align = (header.column.columnDef.meta as { align?: 'left' | 'right' } | undefined)
                  ?.align

                return (
                  <th
                    key={header.id}
                    className={cn(
                      'py-3 font-medium text-muted-foreground relative group',
                      align === 'right' ? 'text-right' : 'text-left',
                      isDraggable && 'cursor-grab select-none',
                    )}
                    style={{ paddingLeft: 16, paddingRight: isResizable ? 24 : 16 }}
                    draggable={isDraggable}
                    onDragStart={isDraggable ? () => onDragStart(columnId) : undefined}
                    onDragOver={isDraggable ? (event) => onDragOver(event, columnId) : undefined}
                    onDragEnd={isDraggable ? onDragEnd : undefined}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {isResizable && (
                      <span
                        className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100"
                        onMouseDown={(event) =>
                          onResizeMouseDown(columnId, header.column.getSize(), event)
                        }
                        draggable={false}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="w-0.5 h-4 bg-white/20 rounded-full" />
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={leafColumns.length}
                className="px-4 py-8 text-center text-muted-foreground text-xs"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-white/5 hover:bg-white/[0.02] transition-colors',
                  getRowClassName?.(row),
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const align = (cell.column.columnDef.meta as { align?: 'left' | 'right' } | undefined)
                    ?.align
                  return (
                    <td
                      key={cell.id}
                      className={cn('py-3', align === 'right' && 'text-right tabular-nums')}
                      style={{ paddingLeft: 16, paddingRight: 16 }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}