'use client'

/**
 * src/components/admin/sos/SplitFeeManager.tsx
 *
 * Manages artist split percentages for SOS generation.
 * Adapted from the standalone SOS generator — i18n removed, imports adjusted.
 */

import { useState } from 'react'
import { Plus, Trash, Percent, Pencil, ChartPieSlice } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { motion, AnimatePresence } from 'framer-motion'
import type { SplitFee } from '@/lib/sos/types'

export interface SplitFeeManagerProps {
  splitFees: SplitFee[]
  onAddSplitFee: (fee: SplitFee) => void
  onRemoveSplitFee: (artist: string) => void
  onUpdateSplitFee?: (artist: string, update: Omit<SplitFee, 'artist'>) => void
  artists?: string[]
}

function clamp(v: number) { return Math.max(0, Math.min(100, v)) }

interface FeeFormProps {
  initialArtist?: string
  initialPercentage?: number
  initialDigital?: string
  initialPhysical?: string
  artists: string[]
  existingArtists: string[]
  isEdit?: boolean
  onSave: (fee: SplitFee) => void
  onCancel: () => void
}

function FeeForm({ initialArtist = '', initialPercentage = 50, initialDigital = '', initialPhysical = '', artists, existingArtists, isEdit, onSave, onCancel }: FeeFormProps) {
  const [artist, setArtist] = useState(initialArtist)
  const [percentage, setPercentage] = useState(String(initialPercentage))
  const [digital, setDigital] = useState(initialDigital)
  const [physical, setPhysical] = useState(initialPhysical)

  const pct = clamp(parseFloat(percentage) || 0)
  const duplicateArtist = !isEdit && existingArtists.includes(artist.trim())

  const handleSave = () => {
    if (!artist.trim() || isNaN(parseFloat(percentage))) return
    onSave({
      artist: artist.trim(),
      percentage: pct,
      digitalPercentage: digital !== '' ? clamp(parseFloat(digital) || 0) : undefined,
      physicalPercentage: physical !== '' ? clamp(parseFloat(physical) || 0) : undefined,
    })
  }

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="split-artist">Artist</Label>
        {isEdit ? (
          <Input id="split-artist" value={artist} disabled />
        ) : (
          <Select value={artist} onValueChange={setArtist}>
            <SelectTrigger id="split-artist">
              <SelectValue placeholder="Select artist…" />
            </SelectTrigger>
            <SelectContent>
              {artists.filter(a => !existingArtists.includes(a) || a === initialArtist).map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
              {artists.length === 0 && (
                <SelectItem value={artist || '_manual'} disabled={false}>
                  {artist || 'Enter name below…'}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        )}
        {!artists.includes(artist) && !isEdit && artist.trim() && (
          <Input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Or type artist name" className="mt-1" />
        )}
        {!isEdit && artist && artists.length === 0 && (
          <Input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Artist name" autoFocus />
        )}
        {artists.length === 0 && !isEdit && !artist && (
          <Input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Artist name" autoFocus />
        )}
        {duplicateArtist && <p className="text-xs text-destructive">A split fee for this artist already exists.</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="split-pct">Default Split (%)</Label>
        <div className="flex items-center gap-2">
          <Input id="split-pct" type="number" min={0} max={100} value={percentage} onChange={e => setPercentage(e.target.value)} className="w-28" />
          <span className="text-sm text-muted-foreground">= label keeps {100 - pct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="split-digital" className="text-xs">Digital override (%)</Label>
          <Input id="split-digital" type="number" min={0} max={100} value={digital} onChange={e => setDigital(e.target.value)} placeholder={`${pct}`} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="split-physical" className="text-xs">Physical override (%)</Label>
          <Input id="split-physical" type="number" min={0} max={100} value={physical} onChange={e => setPhysical(e.target.value)} placeholder={`${pct}`} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={!artist.trim() || isNaN(parseFloat(percentage)) || duplicateArtist}>
          {isEdit ? 'Save' : 'Add Split'}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function SplitFeeManager({ splitFees, onAddSplitFee, onRemoveSplitFee, onUpdateSplitFee, artists = [] }: SplitFeeManagerProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SplitFee | null>(null)

  const existingArtists = splitFees.map(f => f.artist)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChartPieSlice size={20} weight="bold" className="text-primary" />
          <h3 className="font-semibold">Split Fees</h3>
          {splitFees.length > 0 && <Badge variant="secondary">{splitFees.length}</Badge>}
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus size={16} weight="bold" />Add Split</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Artist Split</DialogTitle>
              <DialogDescription>Define the revenue share for an artist.</DialogDescription>
            </DialogHeader>
            <FeeForm
              artists={artists}
              existingArtists={existingArtists}
              onSave={(fee) => { onAddSplitFee(fee); setAddOpen(false) }}
              onCancel={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <AnimatePresence mode="popLayout">
        {splitFees.length > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {splitFees.map((fee, index) => (
              <motion.div key={fee.artist} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: index * 0.04 }}>
                <Card className="p-3 flex items-center gap-3 bg-card hover:shadow-md transition-shadow">
                  <Percent size={18} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{fee.artist}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs text-muted-foreground">{fee.percentage}% default</span>
                      {fee.digitalPercentage !== undefined && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{fee.digitalPercentage}% digital</Badge>
                      )}
                      {fee.physicalPercentage !== undefined && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{fee.physicalPercentage}% physical</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onUpdateSplitFee && (
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget(fee)} className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary">
                        <Pencil size={14} />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onRemoveSplitFee(fee.artist)} className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive">
                      <Trash size={16} />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Card className="p-8 text-center border-dashed">
            <ChartPieSlice size={32} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No split fees configured.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Add a split to define how much revenue each artist receives.</p>
          </Card>
        )}
      </AnimatePresence>

      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Split Fee</DialogTitle>
            <DialogDescription>Update the revenue split percentages for {editTarget?.artist}.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <FeeForm
              initialArtist={editTarget.artist}
              initialPercentage={editTarget.percentage}
              initialDigital={editTarget.digitalPercentage !== undefined ? String(editTarget.digitalPercentage) : ''}
              initialPhysical={editTarget.physicalPercentage !== undefined ? String(editTarget.physicalPercentage) : ''}
              artists={artists}
              existingArtists={existingArtists}
              isEdit
              onSave={(fee) => { onUpdateSplitFee?.(editTarget.artist, { percentage: fee.percentage, digitalPercentage: fee.digitalPercentage, physicalPercentage: fee.physicalPercentage }); setEditTarget(null) }}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
