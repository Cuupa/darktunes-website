'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { DownloadSimple, FileArrowDown } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Dictionary } from '@/i18n/types'
import type { PressPhoto } from '@/lib/api/pressPhotos'
import { getJournalistDownloadUrl } from '../../_actions/download'
import { getPressKitUrls } from '../_actions/downloadZip'

interface PressKitListProps {
  photos: PressPhoto[]
  dict: Dictionary['pressKit']
}

const IMAGE_CATEGORIES = new Set(['photo', 'logo', 'social'])

export function PressKitList({ photos, dict }: PressKitListProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'photo' | 'logo' | 'social' | 'document'>('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [preparingZip, setPreparingZip] = useState(false)

  const filtered = useMemo(() => (
    activeTab === 'all' ? photos : photos.filter((photo) => photo.category === activeTab)
  ), [activeTab, photos])

  const imageAssets = filtered.filter((photo) => IMAGE_CATEGORIES.has(photo.category))
  const documentAssets = filtered.filter((photo) => !IMAGE_CATEGORIES.has(photo.category))

  const download = async (photo: PressPhoto) => {
    setLoadingId(photo.id)
    try {
      const result = await getJournalistDownloadUrl(photo.r2Key, null)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">{dict.heading}</h1>
        <Button onClick={() => void downloadZip()} disabled={preparingZip || filtered.length === 0} className="gap-2">
          <FileArrowDown size={16} weight="bold" aria-hidden="true" />
          {preparingZip ? dict.preparingZip : dict.downloadZipAll}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="flex h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="all">{dict.tabs.all}</TabsTrigger>
          <TabsTrigger value="photo">{dict.tabs.photo}</TabsTrigger>
          <TabsTrigger value="logo">{dict.tabs.logo}</TabsTrigger>
          <TabsTrigger value="social">{dict.tabs.social}</TabsTrigger>
          <TabsTrigger value="document">{dict.tabs.document}</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.noAssets}</p>
      ) : (
        <div className="space-y-6">
          {imageAssets.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {imageAssets.map((photo) => (
                <div key={photo.id} className="overflow-hidden rounded-2xl border border-border bg-card/70">
                  <div className="relative aspect-square overflow-hidden">
                    <Image
                      src={getOptimizedImageUrl(photo.publicUrl, 1000)}
                      alt={photo.altText ?? `${photo.title} – press asset`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium">{photo.title}</p>
                      <p className="text-sm text-muted-foreground">{photo.category}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void download(photo)} disabled={loadingId === photo.id}>
                      <DownloadSimple size={16} weight="bold" aria-hidden="true" />
                      {loadingId === photo.id ? dict.preparingZip : dict.downloadZip}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {documentAssets.length > 0 && (
            <div className="space-y-3">
              {documentAssets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card/70 p-4">
                  <div>
                    <p className="font-medium">{asset.title}</p>
                    <p className="text-sm text-muted-foreground">{asset.category}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void download(asset)} disabled={loadingId === asset.id}>
                    <DownloadSimple size={16} weight="bold" aria-hidden="true" />
                    {loadingId === asset.id ? dict.preparingZip : dict.downloadZip}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
