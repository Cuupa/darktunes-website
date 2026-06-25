import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ColumnDef } from '@tanstack/react-table'
import { useAdminTable } from './useAdminTable'

type Row = { id: string; name: string; value: number }

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'value', header: 'Value' },
]

const data: Row[] = [
  { id: '1', name: 'Charlie', value: 3 },
  { id: '2', name: 'Alice', value: 1 },
  { id: '3', name: 'Bob', value: 2 },
  { id: '4', name: 'Delta', value: 4 },
  { id: '5', name: 'Echo', value: 5 },
]

describe('useAdminTable', () => {
  it('paginates client-side data', () => {
    const { result } = renderHook(() =>
      useAdminTable({
        data,
        columns,
        pageSize: 2,
      }),
    )

    expect(result.current.getRowModel().rows).toHaveLength(2)
    expect(result.current.getRowModel().rows[0]?.original.name).toBe('Charlie')
  })

  it('sorts client-side data when sorting state changes', () => {
    const { result, rerender } = renderHook(
      ({ sorting }) =>
        useAdminTable({
          data,
          columns,
          pageSize: 10,
          sorting,
          onSortingChange: () => {},
        }),
      { initialProps: { sorting: [{ id: 'name', desc: false }] } },
    )

    expect(result.current.getRowModel().rows[0]?.original.name).toBe('Alice')

    rerender({ sorting: [{ id: 'name', desc: true }] })
    expect(result.current.getRowModel().rows[0]?.original.name).toBe('Echo')
  })

  it('supports manual server pagination', () => {
    const { result } = renderHook(() =>
      useAdminTable({
        data: data.slice(0, 2),
        columns,
        manualPagination: true,
        pageCount: 3,
        rowCount: 5,
        onPaginationChange: () => {},
        state: { pagination: { pageIndex: 1, pageSize: 2 } },
      }),
    )

    expect(result.current.getPageCount()).toBe(3)
    expect(result.current.getRowCount()).toBe(5)
    expect(result.current.getState().pagination.pageIndex).toBe(1)
  })
})