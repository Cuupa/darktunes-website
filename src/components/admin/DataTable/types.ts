import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
  Table,
  TableOptions,
} from '@tanstack/react-table'

export type { ColumnDef, Row, Table, SortingState, PaginationState, RowSelectionState }

export type AdminTableManualPagination = {
  manualPagination: true
  pageCount: number
  rowCount?: number
  onPaginationChange: OnChangeFn<PaginationState>
  state: { pagination: PaginationState }
}

export type UseAdminTableOptions<TData> = {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  pageSize?: number
  initialSorting?: SortingState
  enableSorting?: boolean
  manualSorting?: boolean
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  enableRowSelection?: boolean
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  getRowId?: TableOptions<TData>['getRowId']
} & (
  | { manualPagination?: false }
  | AdminTableManualPagination
)