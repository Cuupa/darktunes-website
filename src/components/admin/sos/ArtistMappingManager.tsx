'use client'

/**
 * src/components/admin/sos/ArtistMappingManager.tsx
 *
 * Maps CSV artist name variants to their canonical label artist.
 * Adapted from the standalone SOS generator — i18n removed, imports adjusted.
 */

import { useState, useEffect } from 'react'
import { Plus, Trash, GitBranch, Pencil, Sparkle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandItem, CommandList,
} from '@/components/ui/command'
import { CaretUpDown, Check } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ArtistMapping } from '@/lib/sos/types'

export interface ArtistMappingManagerProps {
  mappings: ArtistMapping[]
  onAddMapping: (mapping: Omit<ArtistMapping, 'id'>) => void
  onRemoveMapping: (id: string) => void
  onUpdateMapping?: (id: string, update: Omit<ArtistMapping, 'id'>) => void
  artists?: string[]
  autoMappings?: ArtistMapping[]
}

function ArtistCombobox({
  value,
  onChange,
  options,
  placeholder,
  id,
}: {
  value: string
  onChange: (val: string) => void
  options: string[]
  placeholder?: string
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)

  useEffect(() => { setInputValue(value) }, [value])

  const handleSelect = (selected: string) => {
    setInputValue(selected)
    onChange(selected)
    setOpen(false)
  }

  const filtered = options.filter(o => o.toLowerCase().includes(inputValue.toLowerCase()))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            id={id}
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); onChange(e.target.value) }}
            placeholder={placeholder}
            className="pr-8"
            onFocus={() => setOpen(true)}
          />
          <CaretUpDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </PopoverTrigger>
      {open && filtered.length > 0 && (
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start" onOpenAutoFocus={e => e.preventDefault()}>
          <Command>
            <CommandList>
              <CommandEmpty>No matching artists</CommandEmpty>
              <CommandGroup>
                {filtered.map(artist => (
                  <CommandItem key={artist} value={artist} onSelect={handleSelect}>
                    <Check size={14} className={cn('mr-2 opacity-0', value === artist && 'opacity-100')} />
                    {artist}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      )}
    </Popover>
  )
}

function MappingForm({
  initialFeaturing,
  initialPrimary,
  artists,
  onSave,
  onCancel,
  saveLabel,
}: {
  initialFeaturing?: string
  initialPrimary?: string
  artists: string[]
  onSave: (featuring: string, primary: string) => void
  onCancel: () => void
  saveLabel?: string
}) {
  const [featuring, setFeaturing] = useState(initialFeaturing ?? '')
  const [primary, setPrimary] = useState(initialPrimary ?? '')

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="featuring-name">CSV Name (featuring / alias)</Label>
        <Input
          id="featuring-name"
          value={featuring}
          onChange={e => setFeaturing(e.target.value)}
          placeholder="Name as it appears in the CSV"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="primary-artist">Maps to (primary artist)</Label>
        <ArtistCombobox
          id="primary-artist"
          value={primary}
          onChange={setPrimary}
          options={artists}
          placeholder="Select or enter primary artist name"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(featuring.trim(), primary.trim())} disabled={!featuring.trim() || !primary.trim()}>
          {saveLabel ?? 'Add Mapping'}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function ArtistMappingManager({
  mappings,
  onAddMapping,
  onRemoveMapping,
  onUpdateMapping,
  artists = [],
  autoMappings = [],
}: ArtistMappingManagerProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ArtistMapping | null>(null)

  const allMappings = [...mappings, ...autoMappings]

  const handleAdd = (featuring: string, primary: string) => {
    onAddMapping({ featuringName: featuring, primaryArtist: primary })
    setAddOpen(false)
  }

  const handleEdit = (featuring: string, primary: string) => {
    if (!editTarget) return
    onUpdateMapping?.(editTarget.id, { featuringName: featuring, primaryArtist: primary })
    setEditTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch size={20} weight="bold" className="text-primary" />
          <h3 className="font-semibold">Artist Mappings</h3>
          {allMappings.length > 0 && (
            <Badge variant="secondary">{allMappings.length}</Badge>
          )}
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus size={16} weight="bold" />
              Add Mapping
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Artist Mapping</DialogTitle>
              <DialogDescription>
                Map a CSV name variant or featuring credit to its primary label artist.
              </DialogDescription>
            </DialogHeader>
            <MappingForm
              artists={artists}
              onSave={handleAdd}
              onCancel={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {autoMappings.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/20 rounded-md px-3 py-2">
          <Sparkle size={14} className="text-blue-400" />
          {autoMappings.length} auto-mapped suggestion{autoMappings.length !== 1 ? 's' : ''} from Jaro-Winkler similarity
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {allMappings.length > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {allMappings.map((mapping, index) => (
              <motion.div
                key={mapping.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className="p-3 flex items-center gap-3 bg-card hover:shadow-md transition-shadow">
                  <GitBranch size={18} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate max-w-[180px]">{mapping.featuringName}</p>
                      {mapping.autoMapped && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-500/15 text-blue-400 border-blue-500/30 shrink-0">
                          Auto · {((mapping.mappingScore ?? 0) * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">→ {mapping.primaryArtist}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!mapping.autoMapped && onUpdateMapping && (
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget(mapping)} className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary">
                        <Pencil size={14} />
                      </Button>
                    )}
                    {!mapping.autoMapped && (
                      <Button variant="ghost" size="sm" onClick={() => onRemoveMapping(mapping.id)} className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive">
                        <Trash size={16} />
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Card className="p-8 text-center border-dashed">
            <GitBranch size={32} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No artist mappings yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Add mappings when CSV names differ from roster names.</p>
          </Card>
        )}
      </AnimatePresence>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Artist Mapping</DialogTitle>
            <DialogDescription>Update the CSV alias and its target primary artist.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <MappingForm
              initialFeaturing={editTarget.featuringName}
              initialPrimary={editTarget.primaryArtist}
              artists={artists}
              onSave={handleEdit}
              onCancel={() => setEditTarget(null)}
              saveLabel="Save"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
