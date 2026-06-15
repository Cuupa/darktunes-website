'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  DownloadSimple,
  FileText,
  Table,
  Archive,
  MagnifyingGlass,
  CircleNotch,
  EnvelopeSimple,
  PaperPlaneTilt,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { ArtistRevenue, LabelArtist, LabelInfo, AppDefaults, EmailConfig } from '@/lib/sos/types'
import { buildMailtoLink } from '@/lib/sos/utils'

interface ReportingPanelProps {
  revenues: ArtistRevenue[]
  onDownloadPDF: (artist: string) => void
  onDownloadExcel: (artist: string) => void
  onDownloadAll: () => void
  onDownloadSelected: (artistNames: string[]) => void
  labelArtists?: LabelArtist[]
  labelInfo?: LabelInfo
  appDefaults?: Partial<AppDefaults>
  emailConfig?: Partial<EmailConfig>
  periodStart?: string
  periodEnd?: string
  onPublishToPortal?: (artist: string) => Promise<void>
}

function fmtEur(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value)
}

const ARTIST_CELL_RESERVED_PX = 32
const COL_WIDTH_CHECKBOX = 56
const COL_WIDTH_ACTIONS = 200

type ColId = 'artist' | 'totalRevenue' | 'payout'
type SortMode = 'payout' | 'artist-asc' | 'artist-desc'

interface ColDef {
  id: ColId
  label: string
  defaultWidth: number
  minWidth: number
  align: 'left' | 'right'
}

const INITIAL_COLUMNS: ColDef[] = [
  { id: 'artist',       label: 'Artist',        defaultWidth: 220, minWidth: 100, align: 'left'  },
  { id: 'totalRevenue', label: 'Total Revenue',  defaultWidth: 150, minWidth: 90,  align: 'right' },
  { id: 'payout',       label: 'Payout',         defaultWidth: 150, minWidth: 90,  align: 'right' },
]

export function ReportingPanel({
  revenues,
  onDownloadPDF,
  onDownloadExcel,
  onDownloadAll,
  onDownloadSelected,
  labelArtists = [],
  labelInfo,
  appDefaults,
  emailConfig,
  periodStart,
  periodEnd,
  onPublishToPortal,
}: ReportingPanelProps) {
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set())
  const [publishingArtists, setPublishingArtists] = useState<Set<string>>(new Set())
  const [isPublishingSelected, setIsPublishingSelected] = useState(false)
  const [filter, setFilter] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('payout')

  const period = useMemo(() => {
    if (periodStart && periodEnd) return `${periodStart} – ${periodEnd}`
    return periodStart ?? periodEnd ?? ''
  }, [periodStart, periodEnd])

  const handleSendEmail = useCallback(
    (r: ArtistRevenue) => {
      const roster = labelArtists.find(a => a.name.toLowerCase() === r.artist.toLowerCase())
      const artistEmail = roster?.email ?? ''
      const template = labelInfo?.emailTemplate ?? ''
      if (!template) {
        toast.error('No e-mail template configured. Please add one in Branding > E-Mail-Anschreiben.')
        return
      }
      const amount = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(r.finalAmount)
      const href = buildMailtoLink(
        r.artist,
        artistEmail,
        period,
        amount,
        labelInfo ?? { name: '', address: '' },
        emailConfig ?? {},
        appDefaults ?? {},
        template
      )
      window.open(href, '_blank')
    },
    [labelArtists, labelInfo, appDefaults, emailConfig, period]
  )

  const artistInfoMap = useMemo(() => {
    const map = new Map<string, LabelArtist>()
    for (const artist of labelArtists) {
      map.set(artist.name.toLowerCase(), artist)
    }
    return map
  }, [labelArtists])

  const [colOrder, setColOrder] = useState<ColId[]>(INITIAL_COLUMNS.map(c => c.id))
  const [colWidths, setColWidths] = useState<Record<ColId, number>>(
    Object.fromEntries(INITIAL_COLUMNS.map(c => [c.id, c.defaultWidth])) as Record<ColId, number>
  )

  const resizeRef = useRef<{ id: ColId; startX: number; startW: number } | null>(null)

  const onResizeMouseDown = useCallback((id: ColId, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { id, startX: e.clientX, startW: colWidths[id] }

    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return
      const def = INITIAL_COLUMNS.find(c => c.id === resizeRef.current!.id)!
      const newW = Math.max(def.minWidth, resizeRef.current.startW + ev.clientX - resizeRef.current.startX)
      setColWidths(prev => ({ ...prev, [resizeRef.current!.id]: newW }))
    }
    function onUp() {
      resizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [colWidths])

  const [dragOver, setDragOver] = useState<ColId | null>(null)
  const dragColRef = useRef<ColId | null>(null)

  function onDragStart(id: ColId) { dragColRef.current = id }
  function onDragOver(e: React.DragEvent, id: ColId) {
    e.preventDefault()
    setDragOver(id)
    if (!dragColRef.current || dragColRef.current === id) return
    setColOrder(prev => {
      const next = [...prev]
      const from = next.indexOf(dragColRef.current!)
      const to   = next.indexOf(id)
      if (from === -1 || to === -1) return prev
      next.splice(from, 1)
      next.splice(to, 0, dragColRef.current!)
      return next
    })
    dragColRef.current = id
  }
  function onDragEnd() { dragColRef.current = null; setDragOver(null) }

  const filtered = useMemo(() => {
    const byFilter = revenues.filter(r => r.artist.toLowerCase().includes(filter.toLowerCase()))
    if (sortMode === 'artist-asc') {
      return [...byFilter].sort((a, b) => a.artist.localeCompare(b.artist))
    }
    if (sortMode === 'artist-desc') {
      return [...byFilter].sort((a, b) => b.artist.localeCompare(a.artist))
    }
    return byFilter
  }, [revenues, filter, sortMode])

  const allSelected = filtered.length > 0 && filtered.every(r => selectedArtists.has(r.artist))
  const someSelected = filtered.some(r => selectedArtists.has(r.artist))

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedArtists(prev => { const n = new Set(prev); filtered.forEach(r => n.delete(r.artist)); return n })
    } else {
      setSelectedArtists(prev => { const n = new Set(prev); filtered.forEach(r => n.add(r.artist)); return n })
    }
  }

  function toggleArtist(artist: string) {
    setSelectedArtists(prev => {
      const n = new Set(prev)
      if (n.has(artist)) n.delete(artist)
      else n.add(artist)
      return n
    })
  }

  function exportSelected() { onDownloadSelected(Array.from(selectedArtists)) }

  const publishArtist = useCallback(
    async (artist: string) => {
      if (!onPublishToPortal) return
      setPublishingArtists(prev => new Set(prev).add(artist))
      try {
        await onPublishToPortal(artist)
      } finally {
        setPublishingArtists(prev => {
          const next = new Set(prev)
          next.delete(artist)
          return next
        })
      }
    },
    [onPublishToPortal]
  )

  const publishSelected = useCallback(
    async () => {
      if (!onPublishToPortal || selectedArtists.size === 0) return
      setIsPublishingSelected(true)
      try {
        for (const artist of selectedArtists) {
          await publishArtist(artist)
        }
      } finally {
        setIsPublishingSelected(false)
      }
    },
    [onPublishToPortal, publishArtist, selectedArtists]
  )

  const selectedCount = selectedArtists.size
  const orderedCols = colOrder.map(id => INITIAL_COLUMNS.find(c => c.id === id)!).filter(Boolean)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-card/60 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {selectedCount > 0
              ? `${selectedCount} artist${selectedCount !== 1 ? 's' : ''} selected`
              : 'No artists selected'}
          </span>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleSelectAll} disabled={filtered.length === 0}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={selectedCount === 0} onClick={exportSelected}>
            <Archive size={14} />
            Export Selected to ZIP
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={selectedCount === 0 || !onPublishToPortal || isPublishingSelected}
            onClick={() => void publishSelected()}
          >
            {isPublishingSelected ? <CircleNotch size={14} className="animate-spin" /> : <PaperPlaneTilt size={14} />}
            Publish Selected
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={revenues.length === 0} onClick={onDownloadAll}>
            <DownloadSimple size={14} />
            Export All
          </Button>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-white/5">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative max-w-sm flex-1">
            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter by artist…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="pl-8 h-9 text-sm border-border/60 bg-background/50 focus:border-primary/60"
            />
          </div>
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            className="h-9 rounded-md border border-border/60 bg-background/50 px-3 text-xs text-foreground"
          >
            <option value="payout">Sort: payout</option>
            <option value="artist-asc">Sort: artist A-Z</option>
            <option value="artist-desc">Sort: artist Z-A</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        {revenues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <DownloadSimple size={32} className="opacity-30" />
            <p className="text-sm">No revenue data yet. Upload a CSV to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: colOrder.reduce((s, id) => s + colWidths[id as ColId], 0) + COL_WIDTH_CHECKBOX + COL_WIDTH_ACTIONS }}>
            <colgroup>
              <col style={{ width: COL_WIDTH_CHECKBOX }} />
              {orderedCols.map(col => (
                <col key={col.id} style={{ width: colWidths[col.id] }} />
              ))}
              <col style={{ width: COL_WIDTH_ACTIONS }} />
            </colgroup>
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="w-14 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    data-indeterminate={someSelected && !allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all artists"
                    className="border-2 border-white/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                  />
                </th>
                {orderedCols.map(col => (
                  <th
                    key={col.id}
                    className={`py-3 text-${col.align} font-medium text-muted-foreground select-none relative group cursor-grab ${dragOver === col.id ? 'bg-primary/10' : ''}`}
                    style={{ paddingLeft: 16, paddingRight: 24 }}
                    draggable
                    onDragStart={() => onDragStart(col.id)}
                    onDragOver={e => onDragOver(e, col.id)}
                    onDragEnd={onDragEnd}
                  >
                    <span>{col.label}</span>
                    <span
                      className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100"
                      onMouseDown={e => onResizeMouseDown(col.id, e)}
                      draggable={false}
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="w-0.5 h-4 bg-white/20 rounded-full" />
                    </span>
                  </th>
                ))}
                <th className="py-3 text-right font-medium text-muted-foreground px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={orderedCols.length + 2} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    No artists match your filter.
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.artist} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="w-14 px-4 py-3">
                      <Checkbox
                        checked={selectedArtists.has(r.artist)}
                        onCheckedChange={() => toggleArtist(r.artist)}
                        aria-label={`Select ${r.artist}`}
                        className="border-2 border-white/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                      />
                    </td>
                    {orderedCols.map(col => {
                      if (col.id === 'artist') return (
                        <td key={col.id} className="py-3 font-medium" style={{ paddingLeft: 16, paddingRight: 8 }}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="truncate block"
                              style={{ maxWidth: colWidths.artist - ARTIST_CELL_RESERVED_PX }}
                              title={r.artist}
                            >
                              {r.artist}
                            </span>
                          </div>
                        </td>
                      )
                      if (col.id === 'totalRevenue') return (
                        <td key={col.id} className="py-3 text-right tabular-nums" style={{ paddingLeft: 16, paddingRight: 16 }}>
                          {fmtEur(r.totalRevenue)}
                        </td>
                      )
                      if (col.id === 'payout') return (
                        <td key={col.id} className="py-3 text-right tabular-nums text-emerald-400 font-medium" style={{ paddingLeft: 16, paddingRight: 16 }}>
                          {fmtEur(r.finalAmount)}
                        </td>
                      )
                      return null
                    })}
                    <td className="py-3 text-right px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {onPublishToPortal && !!artistInfoMap.get(r.artist.toLowerCase())?.artistId?.trim() && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 gap-1 text-xs"
                            onClick={() => void publishArtist(r.artist)}
                            title={`Publish statement for ${r.artist}`}
                            disabled={publishingArtists.has(r.artist)}
                          >
                            {publishingArtists.has(r.artist) ? (
                              <CircleNotch size={13} className="animate-spin" />
                            ) : (
                              <PaperPlaneTilt size={13} />
                            )}
                            Publish
                          </Button>
                        )}
                        {labelInfo?.emailTemplate && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => handleSendEmail(r)} title={`Send e-mail to ${r.artist}`}>
                            <EnvelopeSimple size={13} />
                            Email
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => onDownloadPDF(r.artist)} title={`Download PDF for ${r.artist}`}>
                          <FileText size={13} />
                          PDF
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => onDownloadExcel(r.artist)} title={`Download Excel for ${r.artist}`}>
                          <Table size={13} />
                          Excel
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
