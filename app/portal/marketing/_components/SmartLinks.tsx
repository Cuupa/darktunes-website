'use client'

import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { DownloadSimple, Spinner, Trash, UploadSimple } from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getMarketingAssetDownloadUrl } from '../_actions/presignedUrl'
import { validatePortalUpload, PORTAL_ASSET_RULES } from '@/lib/portal/uploadValidation'
import type { Asset, ArtistAsset } from '@/types'

interface SmartLinksProps {
  assets: Asset[]
  artistAssets: ArtistAsset[]
}

export function SmartLinks({ assets, artistAssets: initialArtistAssets }: SmartLinksProps) {
  const t = useTranslations('portal')

  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [artistAssets, setArtistAssets] = useState(initialArtistAssets)
  const [label, setLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [suggestForPress, setSuggestForPress] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const download = async (assetId: string) => {
    setLoadingId(assetId)
    try {
      const result = await getMarketingAssetDownloadUrl(assetId)
      if (!result.url) {
        toast.error(t('statements_downloadError'))
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } finally {
      setLoadingId(null)
    }
  }

  const uploadAsset = async (file: File) => {
    const validationError = validatePortalUpload(file, PORTAL_ASSET_RULES)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setUploading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        toast.error(t('marketing_asset_upload_error'))
        return
      }

      const body = new FormData()
      body.append('file', file)
      body.append('label', label)
      if (suggestForPress && file.type.startsWith('image/')) {
        body.append('pressSuggested', 'true')
      }

      const res = await fetch('/api/portal/upload-asset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      })

      if (!res.ok) {
        toast.error(t('marketing_asset_upload_error'))
        return
      }

      const payload = (await res.json()) as { asset: ArtistAsset }
      setArtistAssets((prev) => [payload.asset, ...prev])
      setLabel('')
      setSuggestForPress(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success(t('marketing_asset_uploaded'))
    } catch {
      toast.error(t('marketing_asset_upload_error'))
    } finally {
      setUploading(false)
    }
  }

  const deleteOwnAsset = async (id: string) => {
    if (!window.confirm(t('marketing_asset_delete_confirm'))) return

    setDeletingId(id)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        toast.error(t('marketing_asset_delete_error'))
        return
      }

      const res = await fetch('/api/portal/upload-asset', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) {
        toast.error(t('marketing_asset_delete_error'))
        return
      }

      setArtistAssets((prev) => prev.filter((asset) => asset.id !== id))
      toast.success(t('marketing_asset_deleted'))
    } catch {
      toast.error(t('marketing_asset_delete_error'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">{t('marketing_heading')}</h1>
        <h2 className="text-2xl font-semibold">{t('marketing_label_assets')}</h2>
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('marketing_label_assets_empty')}</p>
        ) : (
          <div className="space-y-3">
            {assets.map((asset) => (
              <Card key={asset.id} className="bg-card border-border">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{asset.originalFilename}</p>
                    <p className="text-xs text-muted-foreground">{asset.mimeType}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void download(asset.id)} disabled={loadingId === asset.id}>
                    {loadingId === asset.id ? <Spinner size={14} className="mr-1 animate-spin" aria-label="Loading" /> : <DownloadSimple size={14} className="mr-1" />}
                    {t('marketing_asset_download')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">{t('marketing_my_assets')}</h2>

        <Card className="bg-card border-border">
          <CardContent className="space-y-3 p-4">
            <div className="space-y-2">
              <Label htmlFor="asset-label">{t('marketing_asset_label')}</Label>
              <Input id="asset-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <Label htmlFor="artist-asset-file" className="sr-only">{t('marketing_upload_asset')}</Label>
            <input
              id="artist-asset-file"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,application/zip"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadAsset(file)
              }}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="press-suggest"
                checked={suggestForPress}
                onCheckedChange={(value) => setSuggestForPress(value === true)}
              />
              <Label htmlFor="press-suggest" className="text-sm font-normal">
                {t('marketing_press_suggest')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">{t('marketing_press_suggest_hint')}</p>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, PDF, ZIP · max 20 MB</p>
            <Button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} aria-label={t('marketing_upload_asset')}>
              <UploadSimple size={16} className="mr-2" />
              {uploading ? t('marketing_asset_uploading') : t('marketing_upload_asset')}
            </Button>
          </CardContent>
        </Card>

        {artistAssets.length === 0 ? (
          <PortalEmptyState
            icon={UploadSimple}
            heading={t('marketing_my_assets_empty')}
            description={t('marketing_upload_asset')}
          />
        ) : (
          <div className="space-y-3">
            {artistAssets.map((asset) => (
              <Card key={asset.id} className="bg-card border-border">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{asset.originalFilename}</p>
                    <p className="text-xs text-muted-foreground">{asset.label ?? asset.mimeType}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={asset.publicUrl} target="_blank" rel="noopener noreferrer">{t('marketing_asset_download')}</a>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deletingId === asset.id}
                      onClick={() => void deleteOwnAsset(asset.id)}
                    >
                      <Trash size={14} className="mr-1" />
                      {t('marketing_asset_delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
