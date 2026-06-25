'use client'

/**
 * src/components/epk-builder/EpkAssetPicker.tsx
 *
 * Dialog for selecting or uploading marketing assets to insert as canvas images.
 */

import { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { UploadSimple } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getSquareThumbnail } from '@/lib/imageUtils'
import type { ArtistAsset } from '@/types'
import { toast } from 'sonner'

interface EpkAssetPickerProps {
  artistId: string
  open: boolean
  onClose: () => void
  initialAssets: ArtistAsset[]
  onSelect: (url: string) => void
}

function isImageAsset(asset: ArtistAsset): boolean {
  return asset.mimeType.startsWith('image/')
}

export function EpkAssetPicker({
  artistId,
  open,
  onClose,
  initialAssets,
  onSelect,
}: EpkAssetPickerProps) {
  const t = useTranslations('portal')
  const [assets, setAssets] = useState(() => initialAssets.filter(isImageAsset))
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(t('epk_builder_export_auth_error'))
        return
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/portal/upload-asset?artistId=${artistId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      if (!response.ok) {
        throw new Error(t('epk_assets_upload_error'))
      }

      const payload = (await response.json()) as {
        asset: {
          id: string
          artist_id: string
          filename: string
          original_filename: string
          mime_type: string
          size_bytes: number
          r2_key: string
          public_url: string
          label?: string | null
          created_at: string
        }
      }

      const row = payload.asset
      const newAsset: ArtistAsset = {
        id: row.id,
        artistId: row.artist_id,
        filename: row.filename,
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        r2Key: row.r2_key,
        publicUrl: row.public_url,
        label: row.label ?? undefined,
        createdAt: row.created_at,
      }

      if (isImageAsset(newAsset)) {
        setAssets((prev) => [newAsset, ...prev])
      }
      onSelect(newAsset.publicUrl)
      onClose()
      toast.success(t('epk_assets_upload_success'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('epk_assets_upload_error'))
    } finally {
      setUploading(false)
    }
  }, [artistId, t, onClose, onSelect])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0"
        aria-labelledby="epk-asset-picker-title"
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle id="epk-asset-picker-title">{t('epk_assets_title')}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[70vh] p-6 space-y-4" data-lenis-prevent>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleUpload(file)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadSimple className="mr-2 h-4 w-4" aria-hidden="true" />
              {uploading ? t('epk_assets_uploading') : t('epk_assets_upload')}
            </Button>
          </div>

          {assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('epk_assets_empty')}</p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 list-none">
              {assets.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    className="group relative aspect-square w-full overflow-hidden rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      onSelect(asset.publicUrl)
                      onClose()
                    }}
                  >
                    <Image
                      src={getSquareThumbnail(asset.publicUrl, 200)}
                      alt={asset.originalFilename}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      unoptimized
                    />
                  </button>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {asset.originalFilename}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}