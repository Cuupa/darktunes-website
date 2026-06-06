'use client'

/**
 * src/components/admin/sos/TrackRevenueAssignmentManager.tsx
 *
 * UI for creating and managing TrackRevenueAssignment rules.
 * Each rule matches a track/release title substring and redistributes
 * the revenue among one or more co-owner artists (sum must equal 100%).
 */

import { useState, useCallback } from 'react'
import { Plus, Trash, MusicNote, Info, Check, Warning } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TrackRevenueAssignment, RevenueOwner } from '@/lib/sos/types'
import { v4 as uuidv4 } from 'uuid'

interface TrackRevenueAssignmentManagerProps {
  assignments: TrackRevenueAssignment[]
  onAddAssignment: (a: TrackRevenueAssignment) => void
  onRemoveAssignment: (id: string) => void
  availableArtists?: string[]
}

interface OwnerDraft {
  artist: string
  percentage: string
}

const EMPTY_DRAFT: OwnerDraft = { artist: '', percentage: '' }

function OwnerRow({
  owner,
  onChange,
  onRemove,
  artists,
}: {
  owner: OwnerDraft
  onChange: (o: OwnerDraft) => void
  onRemove: () => void
  artists: string[]
}) {
  return (
    <div className="flex gap-2 items-center">
      <Input
        list="track-artists"
        value={owner.artist}
        onChange={e => onChange({ ...owner, artist: e.target.value })}
        placeholder="Artist name"
        className="flex-1 h-8 text-sm"
      />
      <datalist id="track-artists">
        {artists.map(a => <option key={a} value={a} />)}
      </datalist>
      <Input
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={owner.percentage}
        onChange={e => onChange({ ...owner, percentage: e.target.value })}
        placeholder="%"
        className="w-20 h-8 text-sm"
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={onRemove}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      >
        <Trash size={14} />
      </Button>
    </div>
  )
}

export function TrackRevenueAssignmentManager({
  assignments,
  onAddAssignment,
  onRemoveAssignment,
  availableArtists = [],
}: TrackRevenueAssignmentManagerProps) {
  const [trackTitle, setTrackTitle] = useState('')
  const [owners, setOwners] = useState<OwnerDraft[]>([EMPTY_DRAFT])
  const [error, setError] = useState('')

  const ownerSum = owners.reduce((s, o) => {
    const n = parseFloat(o.percentage)
    return s + (Number.isNaN(n) ? 0 : n)
  }, 0)
  const sumOk = Math.abs(ownerSum - 100) < 0.01

  const handleAddOwner = useCallback(() => {
    setOwners(prev => [...prev, { artist: '', percentage: '' }])
  }, [])

  const handleChangeOwner = useCallback((idx: number, o: OwnerDraft) => {
    setOwners(prev => prev.map((item, i) => i === idx ? o : item))
  }, [])

  const handleRemoveOwner = useCallback((idx: number) => {
    setOwners(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const handleAdd = useCallback(() => {
    const title = trackTitle.trim()
    if (!title) {
      setError('Enter a track or release title substring to match.')
      return
    }
    if (owners.length === 0 || owners.every(o => !o.artist.trim())) {
      setError('Add at least one owner artist.')
      return
    }
    const parsed: RevenueOwner[] = owners
      .filter(o => o.artist.trim())
      .map(o => ({ artist: o.artist.trim(), percentage: parseFloat(o.percentage) || 0 }))
    const sum = parsed.reduce((s, o) => s + o.percentage, 0)
    if (Math.abs(sum - 100) >= 0.01) {
      setError(`Owner percentages must sum to 100% (currently ${sum.toFixed(1)}%).`)
      return
    }
    onAddAssignment({ id: uuidv4(), trackTitle: title, owners: parsed })
    setTrackTitle('')
    setOwners([EMPTY_DRAFT])
    setError('')
  }, [trackTitle, owners, onAddAssignment])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <MusicNote size={20} weight="bold" className="text-primary" />
        <h3 className="font-semibold">Track Revenue Assignments</h3>
      </div>

      <Card className="p-4 border border-primary/20 bg-primary/5">
        <div className="flex gap-2">
          <Info size={16} className="text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Assign all revenue from a track or release to specific artists with custom splits.
            Matching is a case-insensitive substring match against release and track title.
            Owner percentages must sum to exactly 100%.
          </p>
        </div>
      </Card>

      {/* Add new assignment */}
      <Card className="p-4 space-y-4">
        <h4 className="text-sm font-semibold">Add Assignment Rule</h4>

        <div className="space-y-2">
          <Label htmlFor="track-title-input">Track / Release Title (substring)</Label>
          <Input
            id="track-title-input"
            value={trackTitle}
            onChange={e => { setTrackTitle(e.target.value); setError('') }}
            placeholder="e.g. Collab Track or Full Album Name"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Owners</Label>
            <span className={`text-xs font-medium ${sumOk ? 'text-green-600' : 'text-destructive'}`}>
              {ownerSum.toFixed(1)}% / 100%
            </span>
          </div>
          <div className="space-y-2">
            {owners.map((owner, idx) => (
              <OwnerRow
                key={idx}
                owner={owner}
                onChange={o => handleChangeOwner(idx, o)}
                onRemove={() => handleRemoveOwner(idx)}
                artists={availableArtists}
              />
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddOwner}
            className="gap-1 h-7 text-xs"
          >
            <Plus size={12} /> Add Owner
          </Button>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <Warning size={13} /> {error}
          </p>
        )}

        <Button
          onClick={handleAdd}
          disabled={!trackTitle.trim() || !sumOk}
          className="gap-1.5"
        >
          <Plus size={15} weight="bold" /> Add Assignment
        </Button>
      </Card>

      {/* Existing assignments */}
      {assignments.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Active Assignments ({assignments.length})</h4>
          {assignments.map(a => {
            const ownerList = a.owners && a.owners.length > 0
              ? a.owners
              : a.ownerArtist ? [{ artist: a.ownerArtist, percentage: 100 }] : []
            return (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <MusicNote size={14} className="text-primary flex-shrink-0" />
                      <p className="text-sm font-medium truncate">{a.trackTitle}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ownerList.map(o => (
                        <Badge key={o.artist} variant="secondary" className="text-xs gap-1">
                          <Check size={10} className="text-green-500" />
                          {o.artist} — {o.percentage}%
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveAssignment(a.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                  >
                    <Trash size={15} />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {assignments.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <MusicNote size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No track revenue assignments yet.</p>
          <p className="text-xs mt-1">Add rules above to redistribute revenue for collaborations.</p>
        </div>
      )}
    </div>
  )
}
