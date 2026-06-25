import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ADMIN_TABLE_PAGE_SIZE } from './constants'
import type { UseAdminTableOptions } from './types'

export function useAdminTable<TData>(options: UseAdminTableOptions<TData>) {
  const {
    data,
    columns,
    pageSize = ADMIN_TABLE_PAGE_SIZE,
    initialSorting,
    enableSorting = true,
    manualSorting = false,
    sorting,
    onSortingChange,
    enableRowSelection = false,
    rowSelection,
    onRowSelectionChange,
    getRowId,
    ...rest
  } = options

  const manualPagination = 'manualPagination' in rest && rest.manualPagination === true

  const controlledState = {
    ...(sorting !== undefined ? { sorting } : {}),
    ...(rowSelection !== undefined ? { rowSelection } : {}),
    ...(manualPagination ? { pagination: rest.state.pagination } : {}),
  }

  return useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    enableSorting,
    manualSorting,
    onSortingChange,
    enableRowSelection,
    onRowSelectionChange,
    getRowId,
    initialState: manualPagination
      ? undefined
      : {
          pagination: { pageIndex: 0, pageSize },
          sorting: initialSorting ?? [],
        },
    ...(manualPagination
      ? {
          manualPagination: true as const,
          pageCount: rest.pageCount,
          rowCount: rest.rowCount,
          onPaginationChange: rest.onPaginationChange,
        }
      : {}),
    ...(Object.keys(controlledState).length > 0 ? { state: controlledState } : {}),
  })
}