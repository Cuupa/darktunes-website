'use client'

import { useEffect, useMemo, useState } from 'react'
import NextImage from 'next/image'
import { Image as ImageIcon, MagnifyingGlass, MusicNotes } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Asset } from '@/types'
import { formatBytes, isAudioAsset, isImageAsset } from './utils'

interface AssetPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (asset: Asset) => void
  mimeTypeFilter?: string
  artistId?: string
}

function matchesFilter(asset: Asset, mimeTypeFilter?: string): boolean {
  if (!mimeTypeFilter) return true
  return asset.mimeType.startsWith(mimeTypeFilter)
}

function AssetPickerCard({ asset, onSelect }: { asset: Asset; onSelect: (asset: Asset) => void }) {
  return (
    <button
      type="button"
      className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card/70 p-3 text-left transition hover:border-primary hover:bg-primary/5"
      onClick={() => onSelect(asset)}
    >
      {isImageAsset(asset) ? (
        <NextImage src={asset.publicUrl} alt={`${asset.originalFilename} – asset preview`} width={200} height={112} className="h-28 w-full rounded-md object-cover" unoptimized />
      ) : (
        <div className="flex h-28 items-center justify-center rounded-md border border-border bg-background/60">
          {isAudioAsset(asset) ? <MusicNotes size={24} className="text-secondary" aria-hidden="true" /> : <ImageIcon size={24} className="text-muted-foreground" aria-hidden="true" />}
        </div>
      )}
      <div className="space-y-1">
        <p className="truncate font-medium">{asset.originalFilename}</p>
        <p className="text-xs text-muted-foreground">{asset.mimeType}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(asset.sizeBytes)}</p>
      </div>
    </button>
  )
}

export function AssetPicker({ open, onClose, onSelect, mimeTypeFilter, artistId }: AssetPickerProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [assets, setAssets] = useState<Asset[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) throw new Error('Not authenticated')

        const params = new URLSearchParams()
        if (search.trim()) params.set('search', search.trim())
        if (artistId) params.set('artistId', artistId)
        const response = await fetch(`/api/admin/assets?${params.toString()}`, {
          headers: { Authorization: 'Bearer ' + token },
        })
        if (!response.ok) throw new Error(await response.text())
        const json = (await response.json()) as { assets: Asset[] }
        if (!cancelled) setAssets(json.assets.filter((asset) => matchesFilter(asset, mimeTypeFilter)))
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Failed to load assets')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const timeout = window.setTimeout(() => {
      void load()
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [artistId, mimeTypeFilter, open, search, supabase])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-4xl" aria-labelledby="asset-picker-title">
        <DialogHeader>
          <DialogTitle id="asset-picker-title">Select Asset</DialogTitle>
          <DialogDescription>
            Choose an existing file from the asset library.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search assets…" />
        </div>

        <ScrollArea className="h-[28rem] rounded-md border border-border">
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <p className="col-span-full text-sm text-muted-foreground">Loading assets…</p>
            ) : assets.length === 0 ? (
              <p className="col-span-full text-sm text-muted-foreground">No matching assets found.</p>
            ) : (
              assets.map((asset) => (
                <AssetPickerCard
                  key={asset.id}
                  asset={asset}
                  onSelect={(selectedAsset) => {
                    onSelect(selectedAsset)
                    onClose()
                  }}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
