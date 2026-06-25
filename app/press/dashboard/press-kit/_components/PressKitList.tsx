'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { DownloadSimple, FileArrowDown } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import { PressPhotoLightbox } from '@/components/press/PressPhotoLightbox'
import type { PressAsset } from '@/types'
import { getJournalistDownloadUrl } from '../../_actions/download'
import { getPressKitUrls } from '../_actions/downloadZip'

interface PressKitListProps {
  assets: PressAsset[]
}

const IMAGE_CATEGORIES = new Set(['photo', 'logo', 'social', 'promo', 'live', 'stage', 'artwork'])

function assetTitle(asset: PressAsset): string {
  return asset.pressCaption ?? asset.originalFilename
}

export function PressKitList({ assets }: PressKitListProps) {
  const t = useTranslations('pressKit')
  const [activeTab, setActiveTab] = useState<'all' | 'photo' | 'logo' | 'social' | 'document'>('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [preparingZip, setPreparingZip] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const filtered = useMemo(() => (
    activeTab === 'all'
      ? assets
      : assets.filter((asset) => (asset.pressCategory ?? 'photo') === activeTab)
  ), [activeTab, assets])

  const imageAssets = filtered.filter(
    (asset) => asset.mimeType.startsWith('image/') || IMAGE_CATEGORIES.has(asset.pressCategory ?? 'photo'),
  )
  const documentAssets = filtered.filter(
    (asset) => !asset.mimeType.startsWith('image/') && !IMAGE_CATEGORIES.has(asset.pressCategory ?? 'photo'),
  )

  const download = async (asset: PressAsset) => {
    setLoadingId(asset.id)
    try {
      const result = await getJournalistDownloadUrl(asset.r2Key, null, asset.id)
      if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer')
    } finally {
      setLoadingId(null)
    }
  }

  const downloadZip = async () => {
    setPreparingZip(true)
    try {
      const result = await getPressKitUrls(filtered.map((item) => item.r2Key))
      if (result.error) {
        toast.error(result.error)
        return
      }
      result.urls.forEach(({ url }) => window.open(url, '_blank', 'noopener,noreferrer'))
    } finally {
      setPreparingZip(false)
    }
  }

  const openLightbox = (assetId: string) => {
    const index = imageAssets.findIndex((asset) => asset.id === assetId)
    if (index < 0) return
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">{t('heading')}</h1>
        <Button onClick={() => void downloadZip()} disabled={preparingZip || filtered.length === 0} className="gap-2">
          <FileArrowDown size={16} weight="bold" aria-hidden="true" />
          {preparingZip ? t('preparingZip') : t('downloadZipAll')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="flex h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="all">{t('tabs.all')}</TabsTrigger>
          <TabsTrigger value="photo">{t('tabs.photo')}</TabsTrigger>
          <TabsTrigger value="logo">{t('tabs.logo')}</TabsTrigger>
          <TabsTrigger value="social">{t('tabs.social')}</TabsTrigger>
          <TabsTrigger value="document">{t('tabs.document')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noAssets')}</p>
      ) : (
        <div className="space-y-6">
          {imageAssets.length > 0 && (
            <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {imageAssets.map((asset) => (
                <li key={asset.id} className="overflow-hidden rounded-2xl border border-border bg-card/70">
                  <button
                    type="button"
                    className="group relative block aspect-square w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openLightbox(asset.id)}
                    aria-label={`View ${assetTitle(asset)}`}
                  >
                    <Image
                      src={getOptimizedImageUrl(asset.publicUrl, 1000)}
                      alt={asset.altText ?? `${assetTitle(asset)} – press asset`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </button>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{assetTitle(asset)}</p>
                      <p className="text-sm text-muted-foreground">{asset.pressCategory ?? 'photo'}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void download(asset)} disabled={loadingId === asset.id}>
                      <DownloadSimple size={16} weight="bold" aria-hidden="true" />
                      {loadingId === asset.id ? t('preparingZip') : t('downloadZip')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {documentAssets.length > 0 && (
            <div className="space-y-3">
              {documentAssets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card/70 p-4">
                  <div>
                    <p className="font-medium">{assetTitle(asset)}</p>
                    <p className="text-sm text-muted-foreground">{asset.pressCategory ?? 'document'}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void download(asset)} disabled={loadingId === asset.id}>
                    <DownloadSimple size={16} weight="bold" aria-hidden="true" />
                    {loadingId === asset.id ? t('preparingZip') : t('downloadZip')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <PressPhotoLightbox
        photos={imageAssets}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onDownload={(asset) => void download(asset)}
      />
    </div>
  )
}