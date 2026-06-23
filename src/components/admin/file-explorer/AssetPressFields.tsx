'use client'

import { useEffect, useState } from 'react'
import { Newspaper, Plus, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { Asset, PressCategory } from '@/types'

const PRESS_CATEGORIES: { value: PressCategory; label: string }[] = [
  { value: 'photo', label: 'Photo' },
  { value: 'promo', label: 'Promo' },
  { value: 'live', label: 'Live' },
  { value: 'stage', label: 'Stage' },
  { value: 'artwork', label: 'Artwork' },
  { value: 'logo', label: 'Logo' },
  { value: 'social', label: 'Social' },
  { value: 'document', label: 'Document' },
  { value: 'other', label: 'Other' },
]

export interface AssetPressDraft {
  altText: string
  isPressApproved: boolean
  pressSuggested: boolean
  pressCategory: PressCategory | ''
  pressCaption: string
  photographerCredit: string
  downloadableForPress: boolean
}

function draftFromAsset(asset: Asset): AssetPressDraft {
  return {
    altText: asset.altText ?? '',
    isPressApproved: asset.isPressApproved,
    pressSuggested: asset.pressSuggested,
    pressCategory: asset.pressCategory ?? '',
    pressCaption: asset.pressCaption ?? '',
    photographerCredit: asset.photographerCredit ?? '',
    downloadableForPress: asset.downloadableForPress,
  }
}

interface AssetPressFieldsProps {
  asset: Asset
  artists: Array<{ id: string; name: string }>
  authToken: string | null
  onSave: (draft: AssetPressDraft) => Promise<void>
  onAssetChange: (asset: Asset) => void
  className?: string
}

export function AssetPressFields({
  asset,
  artists,
  authToken,
  onSave,
  onAssetChange,
  className,
}: AssetPressFieldsProps) {
  const [draft, setDraft] = useState<AssetPressDraft>(() => draftFromAsset(asset))
  const [saving, setSaving] = useState(false)
  const [kitArtistId, setKitArtistId] = useState<string>('label')
  const [addingToKit, setAddingToKit] = useState(false)

  useEffect(() => {
    setDraft(draftFromAsset(asset))
  }, [asset])

  const patchField = <K extends keyof AssetPressDraft>(key: K, value: AssetPressDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      toast.success('Press metadata saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const togglePressApproved = async (approved: boolean) => {
    const nextDraft: AssetPressDraft = {
      ...draft,
      isPressApproved: approved,
      pressSuggested: approved ? false : draft.pressSuggested,
    }
    setDraft(nextDraft)
    setSaving(true)
    try {
      await onSave(nextDraft)
      onAssetChange({ ...asset, isPressApproved: approved, pressSuggested: approved ? false : asset.pressSuggested })
      toast.success(approved ? 'Marked as press photo' : 'Removed from press downloads')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Update failed')
      setDraft(draftFromAsset(asset))
    } finally {
      setSaving(false)
    }
  }

  const addToPressKit = async () => {
    if (!authToken) {
      toast.error('Not authenticated')
      return
    }
    setAddingToKit(true)
    try {
      const response = await fetch('/api/admin/press-kit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          assetId: asset.id,
          artistId: kitArtistId === 'label' ? null : kitArtistId,
        }),
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text)
      }
      toast.success('Added to press kit')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add to press kit')
    } finally {
      setAddingToKit(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center gap-2">
        <Newspaper size={18} className="text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Press metadata</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={draft.isPressApproved ? 'default' : 'outline'}
          disabled={saving}
          onClick={() => void togglePressApproved(!draft.isPressApproved)}
          aria-pressed={draft.isPressApproved}
        >
          {draft.isPressApproved ? 'Press approved' : 'Mark as press'}
        </Button>
        {draft.pressSuggested && (
          <span className="inline-flex items-center rounded-full bg-secondary/20 px-2 py-1 text-xs text-secondary">
            Artist suggestion
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="press-alt-text">Alt text</Label>
          <Input
            id="press-alt-text"
            value={draft.altText}
            onChange={(e) => patchField('altText', e.target.value)}
            placeholder="Describe the image for accessibility"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="press-category">Category</Label>
          <Select
            value={draft.pressCategory || 'none'}
            onValueChange={(value) => patchField('pressCategory', value === 'none' ? '' : (value as PressCategory))}
          >
            <SelectTrigger id="press-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {PRESS_CATEGORIES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="press-caption">Caption</Label>
          <Input
            id="press-caption"
            value={draft.pressCaption}
            onChange={(e) => patchField('pressCaption', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="press-photographer">Photographer credit</Label>
          <Input
            id="press-photographer"
            value={draft.photographerCredit}
            onChange={(e) => patchField('photographerCredit', e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <Label htmlFor="press-downloadable" className="text-sm">Downloadable for press</Label>
          <Switch
            id="press-downloadable"
            checked={draft.downloadableForPress}
            onCheckedChange={(checked) => patchField('downloadableForPress', checked)}
          />
        </div>
      </div>

      <Button type="button" onClick={() => void handleSave()} disabled={saving}>
        {saving ? 'Saving…' : 'Save press metadata'}
      </Button>

      <div className="space-y-2 border-t border-border pt-4">
        <Label htmlFor="press-kit-artist">Add to press kit</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={kitArtistId} onValueChange={setKitArtistId}>
            <SelectTrigger id="press-kit-artist" className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="label">Label-wide</SelectItem>
              {artists.map((artist) => (
                <SelectItem key={artist.id} value={artist.id}>{artist.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className="gap-2 shrink-0"
            disabled={addingToKit || !draft.isPressApproved}
            onClick={() => void addToPressKit()}
          >
            <Plus size={16} aria-hidden="true" />
            Add
          </Button>
        </div>
        {!draft.isPressApproved && (
          <p className="text-xs text-muted-foreground">Approve the asset before adding it to a press kit.</p>
        )}
      </div>

      {draft.isPressApproved && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
          disabled={saving}
          onClick={() => void togglePressApproved(false)}
        >
          <X size={14} aria-hidden="true" />
          Remove from press downloads
        </Button>
      )}
    </div>
  )
}