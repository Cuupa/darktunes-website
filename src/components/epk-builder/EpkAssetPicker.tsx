'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Images, UploadSimple } from '@phosphor-icons/react'
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
import type { ArtistAsset } from '@/types'
import { toast } from 'sonner'

interface EpkAssetPickerProps {
  artistId: string
  open: boolean
  onClose: () => void
  initialAssets: ArtistAsset[]
  onSelect: (url: string) => void
}

type PickerTab = 'uploads' | 'library'

function isImageAsset(asset: Pick<ArtistAsset, 'mimeType'>): boolean {
  return asset.mimeType.startsWith('image/')
}

function normalizeUploadedAsset(asset: unknown): ArtistAsset | null {
  if (!asset || typeof asset !== 'object') return null
  const row = asset as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id : null
  const publicUrl = typeof row.publicUrl === 'string'
    ? row.publicUrl
    : typeof row.public_url === 'string'
      ? row.public_url
      : null
  if (!id || !publicUrl) return null

  return {
    id,
    artistId: typeof row.artistId === 'string' ? row.artistId : String(row.artist_id ?? ''),
    filename: typeof row.filename === 'string' ? row.filename : '',
    originalFilename:
      typeof row.originalFilename === 'string'
        ? row.originalFilename
        : typeof row.original_filename === 'string'
          ? row.original_filename
          : '',
    mimeType:
      typeof row.mimeType === 'string'
        ? row.mimeType
        : typeof row.mime_type === 'string'
          ? row.mime_type
          : 'image/jpeg',
    sizeBytes:
      typeof row.sizeBytes === 'number'
        ? row.sizeBytes
        : typeof row.size_bytes === 'number'
          ? row.size_bytes
          : 0,
    r2Key:
      typeof row.r2Key === 'string'
        ? row.r2Key
        : typeof row.r2_key === 'string'
          ? row.r2_key
          : '',
    publicUrl,
    label: typeof row.label === 'string' ? row.label : undefined,
    createdAt:
      typeof row.createdAt === 'string'
        ? row.createdAt
        : typeof row.created_at === 'string'
          ? row.created_at
          : new Date().toISOString(),
  }
}

export function EpkAssetPicker({
  artistId,
  open,
  onClose,
  initialAssets,
  onSelect,
}: EpkAssetPickerProps) {
  const t = useTranslations('portal')
  const [tab, setTab] = useState<PickerTab>('uploads')
  const [uploadAssets, setUploadAssets] = useState(() => initialAssets.filter(isImageAsset))
  const [libraryAssets, setLibraryAssets] = useState<ArtistAsset[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setUploadAssets(initialAssets.filter(isImageAsset))
  }, [initialAssets, open])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const loadLibrary = async () => {
      setLoadingLibrary(true)
      try {
        const supabase = createBrowserSupabaseClient()
        const { data, error } = await supabase
          .from('assets')
          .select('id, artist_id, filename, original_filename, mime_type, size_bytes, r2_key, public_url, created_at')
          .eq('artist_id', artistId)
          .order('created_at', { ascending: false })

        if (error) throw error
        if (cancelled) return

        const mapped = (data ?? [])
          .filter((row) => row.mime_type.startsWith('image/'))
          .map((row) => ({
            id: row.id,
            artistId: row.artist_id ?? artistId,
            filename: row.filename,
            originalFilename: row.original_filename,
            mimeType: row.mime_type,
            sizeBytes: row.size_bytes,
            r2Key: row.r2_key,
            publicUrl: row.public_url,
            createdAt: row.created_at,
          }))

        setLibraryAssets(mapped)
      } catch {
        if (!cancelled) setLibraryAssets([])
      } finally {
        if (!cancelled) setLoadingLibrary(false)
      }
    }

    void loadLibrary()
    return () => { cancelled = true }
  }, [artistId, open])

  const visibleAssets = useMemo(() => {
    const source = tab === 'uploads' ? uploadAssets : libraryAssets
    const seen = new Set<string>()
    return source.filter((asset) => {
      if (seen.has(asset.publicUrl)) return false
      seen.add(asset.publicUrl)
      return true
    })
  }, [libraryAssets, tab, uploadAssets])

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
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message ?? t('epk_assets_upload_error'))
      }

      const payload = (await response.json()) as { asset?: unknown }
      const newAsset = normalizeUploadedAsset(payload.asset)
      if (!newAsset || !isImageAsset(newAsset)) {
        throw new Error(t('epk_assets_upload_error'))
      }

      setUploadAssets((prev) => [newAsset, ...prev])
      setTab('uploads')
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
        aria-describedby="epk-asset-picker-desc"
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle id="epk-asset-picker-title">{t('epk_assets_title')}</DialogTitle>
          <DialogDescription id="epk-asset-picker-desc">{t('epk_assets_desc')}</DialogDescription>
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
              variant={tab === 'uploads' ? 'secondary' : 'outline'}
              size="sm"
              className="min-h-[44px]"
              onClick={() => setTab('uploads')}
            >
              {t('epk_assets_tab_uploads')}
            </Button>
            <Button
              type="button"
              variant={tab === 'library' ? 'secondary' : 'outline'}
              size="sm"
              className="min-h-[44px]"
              onClick={() => setTab('library')}
            >
              <Images className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('epk_assets_tab_library')}
            </Button>
          </div>

          {tab === 'library' && loadingLibrary ? (
            <p className="text-sm text-muted-foreground">{t('epk_assets_loading')}</p>
          ) : visibleAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('epk_assets_empty')}</p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 list-none">
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