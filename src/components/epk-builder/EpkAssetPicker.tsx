'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Images, UploadSimple, UserCircle } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getSquareThumbnail } from '@/lib/imageUtils'
import type { EpkPickerAsset } from '@/lib/epk/pickerAssets'
import { toast } from 'sonner'

interface EpkAssetPickerProps {
  artistId: string
  open: boolean
  onClose: () => void
  pickerAssets: EpkPickerAsset[]
  onSelect: (url: string) => void
  mode?: 'insert' | 'replace'
}

type PickerTab = 'all' | 'profile' | 'label'

function normalizeUploadedAsset(asset: unknown): EpkPickerAsset | null {
  if (!asset || typeof asset !== 'object') return null
  const row = asset as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id : null
  const publicUrl = typeof row.publicUrl === 'string'
    ? row.publicUrl
    : typeof row.public_url === 'string'
      ? row.public_url
      : null
  if (!id || !publicUrl) return null

  const mimeType =
    typeof row.mimeType === 'string'
      ? row.mimeType
      : typeof row.mime_type === 'string'
        ? row.mime_type
        : 'image/jpeg'

  if (!mimeType.startsWith('image/')) return null

  return {
    id,
    publicUrl,
    originalFilename:
      typeof row.originalFilename === 'string'
        ? row.originalFilename
        : typeof row.original_filename === 'string'
          ? row.original_filename
          : 'Uploaded image',
    mimeType,
    source: 'upload',
  }
}

export function EpkAssetPicker({
  artistId,
  open,
  onClose,
  pickerAssets,
  onSelect,
  mode = 'insert',
}: EpkAssetPickerProps) {
  const t = useTranslations('portal')
  const [tab, setTab] = useState<PickerTab>('all')
  const [assets, setAssets] = useState(pickerAssets)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setAssets(pickerAssets)
    setTab('all')
  }, [pickerAssets, open])

  const visibleAssets = useMemo(() => {
    if (tab === 'profile') {
      return assets.filter((asset) => asset.source === 'profile' || asset.source === 'gallery' || asset.source === 'logo')
    }
    if (tab === 'label') {
      return assets.filter((asset) => asset.source === 'label')
    }
    return assets
  }, [assets, tab])

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
        const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null
        throw new Error(payload?.message ?? payload?.error ?? t('epk_assets_upload_error'))
      }

      const payload = (await response.json()) as { asset?: unknown }
      const newAsset = normalizeUploadedAsset(payload.asset)
      if (!newAsset) {
        throw new Error(t('epk_assets_upload_error'))
      }

      setAssets((prev) => [newAsset, ...prev])
      setTab('all')
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
        className="max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl lg:max-w-3xl p-0"
        aria-labelledby="epk-asset-picker-title"
        aria-describedby="epk-asset-picker-desc"
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle id="epk-asset-picker-title">
            {mode === 'replace' ? t('epk_assets_replace_title') : t('epk_assets_title')}
          </DialogTitle>
          <DialogDescription id="epk-asset-picker-desc">
            {mode === 'replace' ? t('epk_assets_replace_desc') : t('epk_assets_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[70vh] p-6 space-y-4" data-lenis-prevent>
          <div className="flex flex-wrap items-center gap-2">
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
            <Button
              type="button"
              variant={tab === 'all' ? 'secondary' : 'outline'}
              size="sm"
              className="min-h-[44px]"
              onClick={() => setTab('all')}
            >
              {t('epk_assets_tab_all')}
            </Button>
            <Button
              type="button"
              variant={tab === 'profile' ? 'secondary' : 'outline'}
              size="sm"
              className="min-h-[44px]"
              onClick={() => setTab('profile')}
            >
              <UserCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('epk_assets_tab_profile')}
            </Button>
            <Button
              type="button"
              variant={tab === 'label' ? 'secondary' : 'outline'}
              size="sm"
              className="min-h-[44px]"
              onClick={() => setTab('label')}
            >
              <Images className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('epk_assets_tab_library')}
            </Button>
          </div>

          {visibleAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('epk_assets_empty')}</p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 list-none">
              {visibleAssets.map((asset) => (
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