'use client'

/**
 * src/components/admin/sos/IgnoredEntriesManager.tsx
 *
 * Manages entries explicitly excluded from SOS calculations.
 * Adapted from the standalone SOS generator — i18n removed, imports adjusted.
 * SearchableCombobox replaced with Input + Select for darktunes compatibility.
 */

import { useState } from 'react'
import { Plus, Trash, EyeSlash } from '@phosphor-icons/react'
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
import type { IgnoredEntry } from '@/lib/sos/types'

export interface IgnoredEntriesManagerProps {
  entries: IgnoredEntry[]
  onAddEntry: (entry: Omit<IgnoredEntry, 'id' | 'createdAt'>) => void
  onRemoveEntry: (id: string) => void
  artists?: string[]
  releaseTitles?: string[]
}

export function IgnoredEntriesManager({ entries, onAddEntry, onRemoveEntry, artists = [], releaseTitles = [] }: IgnoredEntriesManagerProps) {
  const [open, setOpen] = useState(false)
  const [artist, setArtist] = useState('')
  const [artistInput, setArtistInput] = useState('')
  const [releaseTitle, setReleaseTitle] = useState('')
  const [releaseTitleInput, setReleaseTitleInput] = useState('')
  const [note, setNote] = useState('')

  const effectiveArtist = artists.includes(artist) ? artist : (artist === '__manual__' ? artistInput : artistInput)
  const effectiveRelease = releaseTitles.includes(releaseTitle) ? releaseTitle : (releaseTitle === '__manual__' ? releaseTitleInput : releaseTitleInput)

  const handleClose = () => {
    setOpen(false)
    setArtist('')
    setArtistInput('')
    setReleaseTitle('')
    setReleaseTitleInput('')
    setNote('')
  }

  const handleAdd = () => {
    const a = effectiveArtist.trim()
    const r = effectiveRelease.trim()
    if (!a) return
    onAddEntry({ artist: a, releaseTitle: r || undefined, note: note.trim() || undefined })
    handleClose()
  }

  const isDuplicate = (a: string, r?: string) =>
    entries.some(e => e.artist.toLowerCase() === a.toLowerCase() && (e.releaseTitle ?? '') === (r ?? ''))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EyeSlash size={20} weight="bold" className="text-primary" />
          <h3 className="font-semibold">Ignored Entries</h3>
          {entries.length > 0 && <Badge variant="secondary">{entries.length}</Badge>}
        </div>
        <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); else setOpen(true) }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus size={16} weight="bold" />Add Entry</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ignore Entry</DialogTitle>
              <DialogDescription>Exclude an artist (or a specific release) from all SOS calculations.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Artist</Label>
                {artists.length > 0 ? (
                  <>
                    <Select value={artist} onValueChange={v => { setArtist(v); if (v !== '__manual__') setArtistInput('') }}>
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
                  <Input value={artistInput} onChange={e => setArtistInput(e.target.value)} placeholder="Artist name" autoFocus />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Release (optional)</Label>
                <p className="text-xs text-muted-foreground">Leave blank to ignore all releases for this artist.</p>
                {releaseTitles.length > 0 ? (
                  <>
                    <Select value={releaseTitle} onValueChange={v => { setReleaseTitle(v); if (v !== '__manual__') setReleaseTitleInput('') }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All releases (no filter)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All releases</SelectItem>
                        {releaseTitles.slice(0, 50).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        <SelectItem value="__manual__">Enter manually…</SelectItem>
                      </SelectContent>
                    </Select>
                    {releaseTitle === '__manual__' && (
                      <Input value={releaseTitleInput} onChange={e => setReleaseTitleInput(e.target.value)} placeholder="Release title" className="mt-1" />
                    )}
                  </>
                ) : (
                  <Input value={releaseTitleInput} onChange={e => setReleaseTitleInput(e.target.value)} placeholder="Release title (optional)" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ignored-note">Note (optional)</Label>
                <Input id="ignored-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for ignoring…" />
              </div>
              {isDuplicate(effectiveArtist, effectiveRelease || undefined) && (
                <p className="text-xs text-destructive">This entry is already ignored.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleAdd}
                disabled={!effectiveArtist.trim() || isDuplicate(effectiveArtist, effectiveRelease || undefined)}
              >
                Ignore Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <AnimatePresence mode="popLayout">
        {entries.length > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {entries.map((entry, index) => (
              <motion.div key={entry.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: index * 0.04 }}>
                <Card className="p-3 flex items-center gap-3 bg-card hover:shadow-md transition-shadow">
                  <EyeSlash size={18} className="text-orange-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{entry.artist}</p>
                    {entry.releaseTitle ? (
                      <p className="text-xs text-muted-foreground truncate">Release: {entry.releaseTitle}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">All releases</p>
                    )}
                    {entry.note && <p className="text-xs text-muted-foreground/60 truncate italic">{entry.note}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRemoveEntry(entry.id)} className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive shrink-0">
                    <Trash size={16} />
                  </Button>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Card className="p-8 text-center border-dashed">
            <EyeSlash size={32} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No ignored entries.</p>
          </Card>
        )}
      </AnimatePresence>
    </div>
  )
}
