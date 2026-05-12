'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { DownloadSimple, Spinner } from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getMarketingAssetDownloadUrl } from '../_actions/presignedUrl'
import type { Dictionary } from '@/i18n/types'
import type { Asset } from '@/types'

interface SmartLinksProps {
  dict: Dictionary['portal']
  assets: Asset[]
}

export function SmartLinks({ dict, assets }: SmartLinksProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const download = async (assetId: string) => {
    setLoadingId(assetId)
    try {
      const result = await getMarketingAssetDownloadUrl(assetId)
      if (!result.url) {
        toast.error('Failed to generate download link')
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{dict.marketing_heading}</h1>
      <div className="space-y-3">
        {assets.map((asset) => (
          <Card key={asset.id} className="bg-card border-border">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{asset.originalFilename}</p>
                <p className="text-xs text-muted-foreground">{asset.mimeType}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void download(asset.id)} disabled={loadingId === asset.id}>
                {loadingId === asset.id ? <Spinner size={14} className="mr-1 animate-spin" aria-label="Loading" /> : <DownloadSimple size={14} className="mr-1" />}
                Download
              </Button>
            </CardContent>
          </Card>
        ))}
        {assets.length === 0 && <p className="text-sm text-muted-foreground">{dict.marketing_noData}</p>}
      </div>
    </div>
  )
}
