import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from '@phosphor-icons/react'
import type { Column } from '@tanstack/react-table'

type AdminSortableHeaderProps<TData> = {
  column: Column<TData, unknown>
  children: ReactNode
}

export function AdminSortableHeader<TData>({ column, children }: AdminSortableHeaderProps<TData>) {
  const sorted = column.getIsSorted()

  return (
    <button
      type="button"
      className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      aria-label={
        sorted === 'asc'
          ? `Sort ${String(children)} descending`
          : sorted === 'desc'
            ? `Sort ${String(children)} ascending`
            : `Sort by ${String(children)}`
      }
    >
      {children}
      {sorted === 'asc' ? (
        <ArrowUp size={12} className="inline ml-1" aria-hidden="true" />
      ) : sorted === 'desc' ? (
        <ArrowDown size={12} className="inline ml-1" aria-hidden="true" />
      ) : null}
    </button>
  )
}