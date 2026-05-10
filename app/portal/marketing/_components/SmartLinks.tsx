'use client'

/**
 * app/portal/marketing/_components/SmartLinks.tsx — Client Component (leaf)
 *
 * Displays smart links (Odesli) for each release. Shows a copy-to-clipboard button.
 * Receives all data as props (IoC).
 */

import { useState } from 'react'
import Image from 'next/image'
import { Link as LinkIcon, Copy, Check } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Dictionary } from '@/i18n/types'
import type { Release } from '@/types'

interface SmartLinksProps {
  dict: Dictionary['portal']
  releases: Release[]
}

function SmartLinkCard({ dict, release }: { dict: Dictionary['portal']; release: Release }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!release.smartUrl) return
    try {
      await navigator.clipboard.writeText(release.smartUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable — silently ignore
    }
  }

  const typeBadgeVariant =
    release.type === 'album' ? 'default' : release.type === 'ep' ? 'secondary' : 'outline'

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-colors">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          {/* Cover art */}
          <div className="relative w-14 h-14 shrink-0 rounded overflow-hidden bg-muted">
            {release.coverArt ? (
              <Image
                src={getOptimizedImageUrl(release.coverArt, 56)}
                alt={release.title}
                fill
                className="object-cover"
                sizes="56px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                —
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate text-sm">{release.title}</p>
              <Badge variant={typeBadgeVariant} className="text-xs shrink-0 uppercase">
                {release.type}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{release.releaseDate}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <LinkIcon size={12} className="text-muted-foreground shrink-0" />
              {release.smartUrl ? (
                <a
                  href={release.smartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline truncate"
                >
                  {release.smartUrl}
                </a>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  {dict.marketing_noSmartUrl}
                </span>
              )}
            </div>
          </div>

          {/* Copy button */}
          {release.smartUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="shrink-0 border-border gap-1.5"
              title={dict.marketing_copy}
            >
              {copied ? (
                <>
                  <Check size={14} className="text-primary" />
                  <span className="text-xs">{dict.marketing_copied}</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span className="text-xs">{dict.marketing_copy}</span>
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function SmartLinks({ dict, releases }: SmartLinksProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{dict.marketing_heading}</h1>

      {releases.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{dict.marketing_noData}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {releases.map((release) => (
            <SmartLinkCard key={release.id} dict={dict} release={release} />
          ))}
        </div>
      )}
    </div>
  )
}
