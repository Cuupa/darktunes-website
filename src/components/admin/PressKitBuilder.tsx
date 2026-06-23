'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  FolderOpen,
  Plus,
  Trash,
} from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import { cn } from '@/lib/utils'
import type { PressAsset } from '@/types'
import { toast } from 'sonner'
import { AssetPicker } from './file-explorer/AssetPicker'

interface PressKitBuilderProps {
  artists: Array<{ id: string; name: string }>
}

export function PressKitBuilder({ artists }: PressKitBuilderProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [scope, setScope] = useState<string>('label')
  const [items, setItems] = useState<PressAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null)
    })
  }, [supabase])

  const loadItems = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const artistParam = scope === 'label' ? 'label' : scope
      const response = await fetch(`/api/admin/press-kit?artistId=${encodeURIComponent(artistParam)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(await response.text())
      const json = (await response.json()) as { items: PressAsset[] }
      setItems(json.items)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load press kit')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [scope, token])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const scopeLabel = scope === 'label'
    ? 'Label-wide'
    : artists.find((artist) => artist.id === scope)?.name ?? 'Artist'

  const reorder = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length || !token) return
    const next = [...items]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setItems(next)
    try {
      const response = await fetch('/api/admin/press-kit/reorder', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          artistId: scope === 'label' ? null : scope,
          orderedItemIds: next.map((item) => item.kitItemId),
        }),
      })
      if (!response.ok) throw new Error(await response.text())
      toast.success('Order updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reorder failed')
      await loadItems()
    }
  }

  const removeItem = async (item: PressAsset) => {
    if (!token) return
    setBusyId(item.kitItemId)
    try {
      const response = await fetch(`/api/admin/press-kit/${item.kitItemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(await response.text())
      setItems((prev) => prev.filter((row) => row.kitItemId !== item.kitItemId))
      toast.success('Removed from press kit')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Remove failed')
    } finally {
      setBusyId(null)
    }
  }

  const addAsset = async (asset: PressAsset) => {
    if (!token) {
      toast.error('Not authenticated')
      return
    }
    if (!asset.isPressApproved) {
      toast.error('Approve the asset in the Asset Explorer before adding it to a press kit.')
      return
    }
    setPickerOpen(false)
    setBusyId(asset.id)
    try {
      const response = await fetch('/api/admin/press-kit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assetId: asset.id,
          artistId: scope === 'label' ? null : scope,
        }),
      })
      if (!response.ok) throw new Error(await response.text())
      toast.success('Added to press kit')
      await loadItems()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add asset')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card/70">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Press Kit Builder</CardTitle>
            <CardDescription>
              Curate which approved assets appear on public EPK pages and the journalist press kit.
              Upload new files in the{' '}
              <Link href="/admin/assets" className="text-primary underline underline-offset-2">
                Asset Explorer
              </Link>
              .
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-48" aria-label="Press kit scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="label">Label-wide kit</SelectItem>
                {artists.map((artist) => (
                  <SelectItem key={artist.id} value={artist.id}>{artist.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" className="gap-2" onClick={() => setPickerOpen(true)}>
              <Plus size={16} weight="bold" aria-hidden="true" />
              Add asset
            </Button>
            <Button type="button" variant="outline" className="gap-2" asChild>
              <Link href="/admin/assets?pressOnly=1">
                <FolderOpen size={16} weight="bold" aria-hidden="true" />
                Browse press assets
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Editing: <span className="font-medium text-foreground">{scopeLabel}</span>
            {' · '}
            {items.length} item(s)
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No assets in this kit yet. Approve press assets in the Asset Explorer, then add them here.
        </p>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <li
              key={item.kitItemId}
              className={cn(
                'overflow-hidden rounded-2xl border border-border bg-card/70',
                busyId === item.kitItemId && 'opacity-60',
              )}
            >
              <div className="relative aspect-square overflow-hidden">
                <Image
                  src={getOptimizedImageUrl(item.publicUrl, 600)}
                  alt={item.altText ?? `${item.originalFilename} – press photo`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="font-medium truncate">{item.originalFilename}</p>
                  <p className="text-sm text-muted-foreground">
                    {[item.pressCategory, item.photographerCredit].filter(Boolean).join(' · ') || 'Press asset'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="min-h-[44px] min-w-[44px]"
                    disabled={index === 0 || busyId !== null}
                    aria-label={`Move ${item.originalFilename} up`}
                    onClick={() => void reorder(index, index - 1)}
                  >
                    <ArrowUp size={16} weight="bold" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="min-h-[44px] min-w-[44px]"
                    disabled={index === items.length - 1 || busyId !== null}
                    aria-label={`Move ${item.originalFilename} down`}
                    onClick={() => void reorder(index, index + 1)}
                  >
                    <ArrowDown size={16} weight="bold" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="gap-2"
                    disabled={busyId !== null}
                    onClick={() => void removeItem(item)}
                  >
                    <Trash size={14} weight="bold" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AssetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => void addAsset(asset as PressAsset)}
        mimeTypeFilter="image/"
      />
    </div>
  )
}