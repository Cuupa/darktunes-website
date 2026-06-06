'use client'

/**
 * src/components/admin/sos/ManualRevenueManager.tsx
 *
 * Manages manually entered revenue entries.
 * Adapted from the standalone SOS generator — i18n removed, imports adjusted.
 */

import { useState } from 'react'
import { Plus, Trash, CurrencyEur, Pencil } from '@phosphor-icons/react'
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
import type { ManualRevenue } from '@/lib/sos/types'

export interface ManualRevenueManagerProps {
  revenues: ManualRevenue[]
  onAddRevenue: (revenue: Omit<ManualRevenue, 'id'>) => void
  onRemoveRevenue: (id: string) => void
  onUpdateRevenue?: (id: string, update: Omit<ManualRevenue, 'id'>) => void
  artists?: string[]
}

interface RevenueFormProps {
  initialArtist?: string
  initialDescription?: string
  initialAmount?: number
  artists: string[]
  onSave: (artist: string, description: string, amount: number) => void
  onCancel: () => void
  saveLabel?: string
}

function RevenueForm({ initialArtist = '', initialDescription = '', initialAmount, artists, onSave, onCancel, saveLabel }: RevenueFormProps) {
  const [artist, setArtist] = useState(initialArtist)
  const [description, setDescription] = useState(initialDescription)
  const [amount, setAmount] = useState(initialAmount !== undefined ? String(initialAmount) : '')
  const [artistInput, setArtistInput] = useState(artists.includes(initialArtist) ? '' : initialArtist)

  const effectiveArtist = artists.includes(artist) ? artist : artistInput

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Artist</Label>
        {artists.length > 0 ? (
          <>
            <Select value={artist} onValueChange={v => { setArtist(v); setArtistInput('') }}>
              <SelectTrigger>
                <SelectValue placeholder="Select artist…" />
              </SelectTrigger>
              <SelectContent>
                {artists.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                <SelectItem value="__manual__">Enter manually…</SelectItem>
              </SelectContent>
            </Select>
            {artist === '__manual__' && (
              <Input value={artistInput} onChange={e => setArtistInput(e.target.value)} placeholder="Artist name" className="mt-1" />
            )}
          </>
        ) : (
          <Input value={artistInput} onChange={e => setArtistInput(e.target.value)} placeholder="Artist name" />
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="revenue-desc">Description</Label>
        <Input
          id="revenue-desc"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Sync license fee Q4"
          autoFocus={!initialArtist}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="revenue-amount">Amount (EUR)</Label>
        <div className="flex items-center gap-2">
          <CurrencyEur size={16} className="text-muted-foreground shrink-0" />
          <Input
            id="revenue-amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-36"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => onSave(effectiveArtist.trim(), description.trim(), parseFloat(amount) || 0)}
          disabled={!effectiveArtist.trim() || !description.trim() || !amount || isNaN(parseFloat(amount))}
        >
          {saveLabel ?? 'Add Revenue'}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function ManualRevenueManager({ revenues, onAddRevenue, onRemoveRevenue, onUpdateRevenue, artists = [] }: ManualRevenueManagerProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ManualRevenue | null>(null)

  const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CurrencyEur size={20} weight="bold" className="text-primary" />
          <h3 className="font-semibold">Manual Revenues</h3>
          {revenues.length > 0 && (
            <Badge variant="secondary">{revenues.length} · €{totalRevenue.toFixed(2)}</Badge>
          )}
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus size={16} weight="bold" />Add Revenue</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Manual Revenue</DialogTitle>
              <DialogDescription>Enter a revenue entry that is not in the CSV (e.g. sync fees, live royalties).</DialogDescription>
            </DialogHeader>
            <RevenueForm
              artists={artists}
              onSave={(a, d, amt) => { onAddRevenue({ artist: a, description: d, amount: amt }); setAddOpen(false) }}
              onCancel={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <AnimatePresence mode="popLayout">
        {revenues.length > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {revenues.map((rev, index) => (
              <motion.div key={rev.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: index * 0.04 }}>
                <Card className="p-3 flex items-center gap-3 bg-card hover:shadow-md transition-shadow">
                  <CurrencyEur size={18} className="text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{rev.description}</p>
                    <p className="text-xs text-muted-foreground">{rev.artist}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400 shrink-0">€{rev.amount.toFixed(2)}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {onUpdateRevenue && (
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget(rev)} className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary">
                        <Pencil size={14} />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onRemoveRevenue(rev.id)} className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive">
                      <Trash size={16} />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Card className="p-8 text-center border-dashed">
            <CurrencyEur size={32} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No manual revenues yet.</p>
          </Card>
        )}
      </AnimatePresence>

      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Revenue</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <RevenueForm
              initialArtist={editTarget.artist}
              initialDescription={editTarget.description}
              initialAmount={editTarget.amount}
              artists={artists}
              onSave={(a, d, amt) => { onUpdateRevenue?.(editTarget.id, { artist: a, description: d, amount: amt }); setEditTarget(null) }}
              onCancel={() => setEditTarget(null)}
              saveLabel="Save"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
