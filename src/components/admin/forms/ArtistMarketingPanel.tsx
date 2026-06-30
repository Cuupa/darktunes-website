'use client'

import Link from 'next/link'
import { ArrowSquareOut, FolderOpen } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PromoLogManager } from '@/components/admin/PromoLogManager'

interface ArtistMarketingPanelProps {
  artistId?: string
  artistName?: string
}

export function ArtistMarketingPanel({ artistId, artistName }: ArtistMarketingPanelProps) {
  if (!artistId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Save the artist first to manage marketing activities and downloadable assets.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PromoLogManager artistId={artistId} artistName={artistName} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen size={18} aria-hidden="true" />
            Marketing Assets
          </CardTitle>
          <CardDescription>
            Upload files in the Asset Explorer and assign them to this artist. Artists download
            assigned materials under Portal → Marketing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Upload files in the Asset Explorer</li>
            <li>Assign this artist via &quot;Assign to artist&quot;</li>
            <li>Artist sees files under Portal → Marketing</li>
          </ol>
          <Button asChild variant="outline" className="gap-2 min-h-[44px]">
            <Link href="/admin/assets" target="_blank" rel="noopener noreferrer">
              <ArrowSquareOut size={16} aria-hidden="true" />
              Open Asset Explorer
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}