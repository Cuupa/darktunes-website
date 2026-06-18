'use client'

/**
 * src/components/admin/GenresManager.tsx
 *
 * Admin panel for managing the central genre catalogue.
 * Admins and editors can add and delete genres; the list is
 * used as the authoritative source for artist/release genre selection.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash, Tag } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGenres } from '@/hooks/useGenres'

export function GenresManager() {
  const { genres, isLoading, addGenre, removeGenre } = useGenres()
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    try {
      const genre = await addGenre(name)
      if (genre) {
        toast.success('Genre "' + genre.name + '" added.')
        setNewName('')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm('Delete genre "' + name + '"? Artists using this genre will keep it in their existing data.')) return
    const ok = await removeGenre(id)
    if (ok) toast.success('Genre deleted.')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Tag size={20} aria-hidden="true" className="text-primary" />
        <h2 className="text-lg font-semibold">Genre Catalogue</h2>
        <span className="ml-auto text-sm text-muted-foreground">{genres.length} genres</span>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New genre name (e.g. Aggrotech)"
          className="flex-1"
          disabled={saving}
          aria-label="New genre name"
        />
        <Button type="submit" className="min-h-[44px] gap-2 shrink-0" disabled={saving || !newName.trim()}>
          <Plus size={16} aria-hidden="true" />
          Add
        </Button>
      </form>

      {/* Genre list */}
      {isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : genres.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No genres yet. Add the first one above.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3" role="list">
          {genres.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
            >
              <span className="text-sm font-medium">{g.name}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                aria-label={'Delete genre ' + g.name}
                onClick={() => void handleDelete(g.id, g.name)}
              >
                <Trash size={14} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
