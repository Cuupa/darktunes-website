'use client'

import { useCallback } from 'react'
import { Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useR2Explorer } from '@/hooks/useR2Explorer'
import { useTranslations } from 'next-intl'

export function R2Explorer() {
  const t = useTranslations('admin')
  const explorer = useR2Explorer()

  const allSelected =
    explorer.objects.length > 0 &&
    explorer.objects.every((object) => explorer.selectedKeys.has(object.key))

  const handleSelectAll = useCallback(() => {
    if (allSelected) explorer.clearSelection()
    else explorer.selectAll()
  }, [allSelected, explorer.clearSelection, explorer.selectAll])

  const handleDeleteSelected = useCallback(() => {
    const count = explorer.selectedKeys.size
    if (count === 0) return
    if (!window.confirm(t('r2_explorer.delete_confirm', { count }))) return
    void explorer.deleteSelected()
  }, [explorer.selectedKeys.size, t, explorer.deleteSelected])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 flex flex-col gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground mb-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => explorer.navigateToPrefix(null)}
            aria-label={t('r2_explorer.all_objects')}
          >
            {t('r2_explorer.all_objects')}
          </Button>
          {explorer.breadcrumb.map((crumb) => (
            <span key={crumb.prefix} className="flex items-center gap-1">
              <span aria-hidden="true">&rsaquo;</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => explorer.navigateToPrefix(crumb.prefix)}
                aria-label={crumb.label}
              >
                {crumb.label}
              </Button>
            </span>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative min-w-0 flex-1">
            <Input
              value={explorer.searchQuery}
              onChange={(event) => explorer.setSearchQuery(event.target.value)}
              placeholder={t('r2_explorer.search_placeholder')}
              className="pl-9"
              aria-label={t('r2_explorer.search_placeholder')}
            />
          </div>
          <div className="flex items-center gap-2">
            {explorer.selectedKeys.size > 0 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={explorer.isLoading}
                className="gap-2"
              >
                {t('r2_explorer.delete_selected')} ({explorer.selectedKeys.size})
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={explorer.goUp}
              disabled={!explorer.currentPrefix}
            >
              {t('r2_explorer.go_up')}
            </Button>
            {explorer.truncated && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => explorer.loadMore()}
                disabled={explorer.isLoading}
              >
                {t('r2_explorer.load_more')}
              </Button>
            )}
          </div>
        </div>
        {explorer.error && (
          <div className="text-sm text-destructive">{explorer.error}</div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label={t('r2_explorer.select_all')}
                  />
                </TableHead>
                <TableHead>{t('r2_explorer.key')}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('r2_explorer.size')}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('r2_explorer.last_modified')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {explorer.prefixes.map((prefix) => (
                <TableRow key={prefix.prefix}>
                  <TableCell className="w-10">
                    <Checkbox
                      checked={explorer.selectedKeys.has(prefix.prefix)}
                      onCheckedChange={() => explorer.toggleSelect(prefix.prefix)}
                      aria-label={`${t('r2_explorer.folder_size', { count: prefix.count, bytes: explorer.formatBytes(prefix.bytes) })} ${prefix.prefix}`}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium outline-none hover:underline"
                      onClick={() => explorer.navigateToPrefix(prefix.prefix)}
                    >
                      {prefix.prefix}
                    </button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell tabular-nums text-right">
                    {explorer.formatBytes(prefix.bytes)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {t('r2_explorer.folder_size', { count: prefix.count, bytes: explorer.formatBytes(prefix.bytes) })}
                  </TableCell>
                </TableRow>
              ))}
              {explorer.objects.map((object) => (
                <TableRow key={object.key}>
                  <TableCell className="w-10">
                    <Checkbox
                      checked={explorer.selectedKeys.has(object.key)}
                      onCheckedChange={() => explorer.toggleSelect(object.key)}
                      aria-label={object.key}
                    />
                  </TableCell>
                  <TableCell className="truncate">
                    <span className="text-muted-foreground">{object.key}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell tabular-nums text-right">
                    {explorer.formatBytes(object.sizeBytes)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {object.lastModified ? new Date(object.lastModified).toLocaleDateString() : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {explorer.prefixes.length === 0 && explorer.objects.length === 0 && !explorer.isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {explorer.searchQuery.trim()
                      ? t('r2_explorer.no_results')
                      : t('r2_explorer.no_objects')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        {!explorer.isLoading && explorer.objects.length > 0 && explorer.truncated && (
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>{t('r2_explorer.load_more_hint')}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => explorer.loadMore()}>
              {t('r2_explorer.load_more')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
