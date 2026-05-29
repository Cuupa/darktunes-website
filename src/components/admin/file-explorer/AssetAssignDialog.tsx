'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, MagnifyingGlass, Tag, UserCircle, VinylRecord, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Artist, Release } from '@/types'

// ── Artist assignment (multi-select with checkboxes) ──────────────────────────

interface AssignArtistDialogProps {
  open: boolean
  onClose: () => void
  artists: Artist[]
  selectedArtistIds: string[]
  onConfirm: (artistIds: string[]) => void
}

export function AssignArtistDialog({ open, onClose, artists, selectedArtistIds, onConfirm }: AssignArtistDialogProps) {
  const [search, setSearch] = useState('')
  const [chosen, setChosen] = useState<Set<string>>(new Set(selectedArtistIds))

  const filtered = useMemo(
    () => artists.filter((artist) => artist.name.toLowerCase().includes(search.toLowerCase())),
    [artists, search],
  )

  const toggle = (id: string) => {
    setChosen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    onConfirm([...chosen])
    onClose()
  }

  const handleClose = () => {
    setChosen(new Set(selectedArtistIds))
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm" aria-labelledby="assign-artist-title">
        <DialogHeader>
          <DialogTitle id="assign-artist-title" className="flex items-center gap-2">
            <UserCircle size={18} aria-hidden="true" />
            Assign artists
          </DialogTitle>
          <DialogDescription>Select one or more artists to assign to this asset.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <MagnifyingGlass size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-sm"
            placeholder="Search artists…"
            autoFocus
          />
        </div>

        <ScrollArea className="h-56 rounded-md border border-border">
          <ul className="p-1">
            <li>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition hover:bg-accent',
                  chosen.size === 0 && 'font-medium text-foreground',
                )}
                onClick={() => setChosen(new Set())}
              >
                <Check size={14} className={cn('shrink-0', chosen.size > 0 ? 'invisible' : 'text-primary')} aria-hidden="true" />
                Unassigned
              </button>
            </li>
            {filtered.map((artist) => (
              <li key={artist.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition hover:bg-accent"
                  onClick={() => toggle(artist.id)}
                >
                  <Check size={14} className={cn('shrink-0', chosen.has(artist.id) ? 'text-primary' : 'invisible')} aria-hidden="true" />
                  {artist.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">No artists found</li>
            )}
          </ul>
        </ScrollArea>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
          <Button size="sm" onClick={handleConfirm}>Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Release assignment (single-select with search) ────────────────────────────

interface AssignReleaseDialogProps {
  open: boolean
  onClose: () => void
  releases: Release[]
  selectedReleaseId?: string
  onConfirm: (releaseId: string | null) => void
}

export function AssignReleaseDialog({ open, onClose, releases, selectedReleaseId, onConfirm }: AssignReleaseDialogProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => releases.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()) || r.artistName.toLowerCase().includes(search.toLowerCase())),
    [releases, search],
  )

  const handleClose = () => {
    setSearch('')
    onClose()
  }

  const select = (id: string | null) => {
    onConfirm(id)
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm" aria-labelledby="assign-release-title">
        <DialogHeader>
          <DialogTitle id="assign-release-title" className="flex items-center gap-2">
            <VinylRecord size={18} aria-hidden="true" />
            Assign release
          </DialogTitle>
          <DialogDescription>Optionally link this asset to a release.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <MagnifyingGlass size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-sm"
            placeholder="Search releases…"
            autoFocus
          />
        </div>

        <ScrollArea className="h-56 rounded-md border border-border">
          <ul className="p-1">
            <li>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition hover:bg-accent',
                  !selectedReleaseId && 'font-medium text-foreground',
                )}
                onClick={() => select(null)}
              >
                <Check size={14} className={cn('shrink-0', selectedReleaseId ? 'invisible' : 'text-primary')} aria-hidden="true" />
                None
              </button>
            </li>
            {filtered.map((release) => (
              <li key={release.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition hover:bg-accent"
                  onClick={() => select(release.id)}
                >
                  <Check size={14} className={cn('shrink-0', selectedReleaseId === release.id ? 'text-primary' : 'invisible')} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{release.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{release.artistName}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">No releases found</li>
            )}
          </ul>
        </ScrollArea>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Tags editor (free-form chip input) ─────────────────────────────────────────

interface TagsEditorDialogProps {
  open: boolean
  onClose: () => void
  initialTags: string[]
  onConfirm: (tags: string[]) => void
}

export function TagsEditorDialog({ open, onClose, initialTags, onConfirm }: TagsEditorDialogProps) {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync initial tags every time the dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setTags(initialTags)
      setInput('')
    } else {
      handleClose()
    }
  }

  const addPending = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    // split on comma to allow bulk-pasting "foo, bar, baz"
    const parts = trimmed.split(',').map((t) => t.trim()).filter(Boolean)
    setTags((prev) => {
      const next = [...prev]
      for (const part of parts) {
        if (!next.includes(part)) next.push(part)
      }
      return next
    })
    setInput('')
    inputRef.current?.focus()
  }

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addPending()
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  const handleConfirm = () => {
    // commit any text still in the input field
    const trimmed = input.trim()
    const finalTags = [...tags]
    if (trimmed) {
      const parts = trimmed.split(',').map((t) => t.trim()).filter(Boolean)
      for (const part of parts) {
        if (!finalTags.includes(part)) finalTags.push(part)
      }
    }
    onConfirm(finalTags)
    onClose()
  }

  const handleClose = () => {
    setTags(initialTags)
    setInput('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm" aria-labelledby="tags-editor-title">
        <DialogHeader>
          <DialogTitle id="tags-editor-title" className="flex items-center gap-2">
            <Tag size={18} aria-hidden="true" />
            Edit tags
          </DialogTitle>
          <DialogDescription>
            Type a tag and press <kbd className="rounded border border-border px-1 font-mono text-xs">Enter</kbd> or{' '}
            <kbd className="rounded border border-border px-1 font-mono text-xs">,</kbd> to add it. Click a tag to remove it.
          </DialogDescription>
        </DialogHeader>

        {/* Tag chips + inline input */}
        <div
          className="flex min-h-[2.75rem] flex-wrap gap-1.5 rounded-md border border-border bg-input/30 px-2 py-2 focus-within:ring-2 focus-within:ring-ring/50 cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
              className="inline-flex items-center gap-1 rounded-full bg-secondary/20 px-2 py-0.5 text-xs text-secondary hover:bg-destructive/20 hover:text-destructive transition-colors"
              title={`Remove "${tag}"`}
              aria-label={`Remove tag ${tag}`}
            >
              {tag}
              <X size={10} aria-hidden="true" />
            </button>
          ))}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addPending}
            placeholder={tags.length === 0 ? 'Add tags…' : ''}
            className="min-w-[6rem] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            aria-label="New tag"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
          <Button size="sm" onClick={handleConfirm}>Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
