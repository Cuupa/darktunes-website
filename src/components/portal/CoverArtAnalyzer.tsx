'use client'

import { useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/i18n/types'

interface CoverArtAnalyzerProps {
  url: string
  dict: Dictionary['portal']
  onVerified: (verified: boolean) => void
}

type CheckState = 'idle' | 'verifying' | 'ok' | 'wrong_size' | 'wrong_format' | 'blocked'

interface SizeInfo {
  width: number
  height: number
}

/** Check JPEG magic bytes (FF D8 FF) using range request */
async function checkJpegMagicBytes(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-11' },
      // avoid CORS issues — use no-cors will hide response, so we try cors first
      mode: 'cors',
      cache: 'no-store',
    })
    if (!res.ok && res.status !== 206) return false
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    // JPEG magic bytes: FF D8 FF
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  } catch {
    return false
  }
}

/** Load an image via new Image() and return its natural dimensions */
function checkImageDimensions(url: string): Promise<SizeInfo> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = url
  })
}

export function CoverArtAnalyzer({ url, dict, onVerified }: CoverArtAnalyzerProps) {
  const [state, setState] = useState<CheckState>('idle')
  const [sizeInfo, setSizeInfo] = useState<SizeInfo | null>(null)

  const verify = useCallback(async () => {
    if (!url.trim()) return
    setState('verifying')
    onVerified(false)

    try {
      // Check dimensions first
      let dims: SizeInfo
      try {
        dims = await checkImageDimensions(url)
      } catch {
        // Image could not be loaded
        setState('blocked')
        return
      }

      setSizeInfo(dims)

      if (dims.width !== 3000 || dims.height !== 3000) {
        setState('wrong_size')
        return
      }

      // Check JPEG format via magic bytes
      const isJpeg = await checkJpegMagicBytes(url)
      if (!isJpeg) {
        // Fall back: check URL extension for CORS-blocked responses
        const lower = url.toLowerCase()
        const extensionOk = lower.includes('.jpg') || lower.includes('.jpeg')
        if (!extensionOk) {
          setState('wrong_format')
          return
        }
        // If CORS blocks but dimensions look right and extension is JPEG, warn
        setState('blocked')
        return
      }

      setState('ok')
      onVerified(true)
    } catch {
      setState('blocked')
    }
  }, [url, onVerified])

  const getMessage = (): string => {
    switch (state) {
      case 'ok':
        return dict.releases_submit_cover_check_ok
      case 'wrong_size': {
        const msg = dict.releases_submit_cover_check_wrong_size
        return msg
          .replace('{{width}}', String(sizeInfo?.width ?? '?'))
          .replace('{{height}}', String(sizeInfo?.height ?? '?'))
      }
      case 'wrong_format':
        return dict.releases_submit_cover_check_wrong_format
      case 'blocked':
        return dict.releases_submit_cover_check_blocked
      case 'verifying':
        return dict.releases_submit_cover_check_verifying
      default:
        return ''
    }
  }

  const badgeVariant =
    state === 'ok'
      ? 'default'
      : state === 'verifying'
        ? 'secondary'
        : state === 'idle'
          ? 'outline'
          : 'destructive'

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{dict.releases_submit_cover_check_heading}</p>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!url.trim() || state === 'verifying'}
          onClick={() => void verify()}
        >
          {state === 'verifying' ? dict.releases_submit_cover_check_verifying : 'Check Cover Art'}
        </Button>
        {state !== 'idle' && (
          <Badge variant={badgeVariant} className="text-xs">
            {getMessage()}
          </Badge>
        )}
      </div>
    </div>
  )
}
