import { useState } from 'react'
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table'

type UseResizableAdminTableOptions<TData> = {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  getRowId?: (row: TData) => string
  initialColumnOrder?: ColumnOrderState
  initialColumnSizing?: ColumnSizingState
  initialSorting?: SortingState
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
}

export function useResizableAdminTable<TData>({
  data,
  columns,
  getRowId,
  initialColumnOrder,
  initialColumnSizing,
  initialSorting,
  sorting,
  onSortingChange,
}: UseResizableAdminTableOptions<TData>) {
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    initialColumnOrder ?? columns.map((column) => column.id ?? (column as { accessorKey?: string }).accessorKey ?? ''),
  )
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(initialColumnSizing ?? {})
  const [internalSorting, setInternalSorting] = useState<SortingState>(initialSorting ?? [])

  const sortingState = sorting ?? internalSorting
  const handleSortingChange = onSortingChange ?? setInternalSorting

  return useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onSortingChange: handleSortingChange,
    state: {
      columnOrder,
      columnSizing,
      sorting: sortingState,
    },
  })
}