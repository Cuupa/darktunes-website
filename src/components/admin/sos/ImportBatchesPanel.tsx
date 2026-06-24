'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowsClockwise, Database } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DistributorImportBatch } from '@/lib/api/distributorImportBatches'
import type { LabelArtist } from '@/lib/sos/types'

interface ImportBatchesPanelProps {
  labelArtists: LabelArtist[]
}

export function ImportBatchesPanel({ labelArtists }: ImportBatchesPanelProps) {
  const [batches, setBatches] = useState<DistributorImportBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const loadBatches = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sos/import-batches')
      if (!res.ok) throw new Error('Failed to load import batches')
      const data = (await res.json()) as { batches: DistributorImportBatch[] }
      setBatches(data.batches ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load batches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBatches()
  }, [loadBatches])

  const handleReprocess = (batchId: string, persist: boolean) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/sos/import-batches/${batchId}/reprocess`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            persist,
            label_artists: labelArtists.map((la) => ({
              name: la.name,
              artistId: la.artistId,
            })),
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(typeof data?.error === 'string' ? data.error : 'Reprocess failed')
        }
        toast.success(
          persist
            ? `Reprocessed & saved ${data.metricCount ?? 0} metrics from ${data.rowCount ?? 0} rows`
            : `Validated ${data.rowCount ?? 0} rows (${data.metricCount ?? 0} metric groups)`,
        )
        await loadBatches()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Reprocess failed')
      }
    })
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground p-4">Loading Bronze archives…</p>
  }

  if (batches.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
        <Database size={18} />
        No Bronze CSV archives yet. Upload distributor files to archive them in R2.
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-card/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Database size={16} />
          Bronze CSV Archives
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void loadBatches()} disabled={isPending}>
          Refresh
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="px-4 py-2" scope="col">Distributor</th>
              <th className="px-4 py-2" scope="col">Period</th>
              <th className="px-4 py-2" scope="col">Rows</th>
              <th className="px-4 py-2" scope="col">Status</th>
              <th className="px-4 py-2 text-right" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id} className="border-b border-border/50">
                <td className="px-4 py-2 capitalize">{batch.distributor}</td>
                <td className="px-4 py-2 tabular-nums">
                  {batch.periodStart} – {batch.periodEnd}
                </td>
                <td className="px-4 py-2 tabular-nums">{batch.rowCount.toLocaleString()}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className="text-xs capitalize">
                    {batch.status}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleReprocess(batch.id, false)}
                  >
                    Validate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleReprocess(batch.id, true)}
                  >
                    <ArrowsClockwise size={14} className="mr-1" />
                    Rebuild Gold
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}