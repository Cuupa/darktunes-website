'use client'

/**
 * ShareButton — Generic page share action.
 *
 * On browsers that support the Web Share API (most mobile browsers and
 * some desktop browsers) it invokes navigator.share() for native OS-level
 * sharing.  On unsupported browsers it falls back to copying the current
 * page URL to the clipboard and shows a sonner toast.
 */

import { useState } from 'react'
import { ShareNetwork } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface ShareButtonProps {
  title: string
  text?: string
  /** i18n labels */
  labels: {
    share: string
    shareSuccess: string
    shareLinkCopied: string
    shareError: string
  }
}

export function ShareButton({ title, text, labels }: ShareButtonProps) {
  const [shared, setShared] = useState(false)

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, text, url })
        setShared(true)
        toast.success(labels.shareSuccess)
        setTimeout(() => setShared(false), 2000)
      } catch (err) {
        // AbortError = user dismissed the share sheet — not an actual error
        if (err instanceof Error && err.name !== 'AbortError') {
          toast.error(labels.shareError)
        }
      }
    } else {
      // Clipboard fallback
      try {
        await (navigator as Navigator).clipboard.writeText(url)
        setShared(true)
        toast.success(labels.shareLinkCopied)
        setTimeout(() => setShared(false), 2000)
      } catch {
        toast.error(labels.shareError)
      }
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleShare}
      aria-label={labels.share}
      className="gap-1.5 border-border"
    >
      <ShareNetwork
        size={16}
        weight={shared ? 'fill' : 'regular'}
        aria-hidden="true"
      />
      {labels.share}
    </Button>
  )
}
