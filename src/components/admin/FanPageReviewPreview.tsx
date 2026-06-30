'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowSquareOut, DeviceMobile, Desktop } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

interface FanPageReviewPreviewProps {
  artistId: string
  artistSlug: string
}

async function getToken(): Promise<string> {
  const session = await createBrowserSupabaseClient().auth.getSession()
  return session.data.session?.access_token ?? ''
}

export function FanPageReviewPreview({ artistId, artistSlug }: FanPageReviewPreviewProps) {
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/fan-page/review/${artistId}/preview-token`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Preview failed')
      const data = (await res.json()) as { previewPath: string }
      setPreviewPath(data.previewPath)
    } catch {
      setError('Could not load fan page preview.')
      setPreviewPath(null)
    } finally {
      setLoading(false)
    }
  }, [artistId])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  return (
    <section className="space-y-3" aria-labelledby="fan-page-review-preview-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="fan-page-review-preview-heading" className="text-sm font-semibold">
            Fan page preview
          </h3>
          <p className="text-xs text-muted-foreground">
            Review the page as fans will see it before approving.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={device === 'desktop' ? 'default' : 'outline'}
            className="min-h-[36px]"
            onClick={() => setDevice('desktop')}
            aria-pressed={device === 'desktop'}
          >
            <Desktop size={16} className="mr-1.5" aria-hidden />
            Desktop
          </Button>
          <Button
            type="button"
            size="sm"
            variant={device === 'mobile' ? 'default' : 'outline'}
            className="min-h-[36px]"
            onClick={() => setDevice('mobile')}
            aria-pressed={device === 'mobile'}
          >
            <DeviceMobile size={16} className="mr-1.5" aria-hidden />
            Mobile
          </Button>
          {previewPath && (
            <Button type="button" size="sm" variant="outline" className="min-h-[36px]" asChild>
              <a href={previewPath} target="_blank" rel="noopener noreferrer">
                <ArrowSquareOut size={16} className="mr-1.5" aria-hidden />
                Open in new tab
              </a>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-[36px]"
            disabled={loading}
            onClick={() => void loadPreview()}
          >
            Reload
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-3">
        {loading && (
          <div
            className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground"
            aria-live="polite"
          >
            Loading preview…
          </div>
        )}
        {!loading && error && (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <p>{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadPreview()}>
              Retry preview
            </Button>
          </div>
        )}
        {!loading && !error && previewPath && (
          <div className="flex justify-center">
            <iframe
              title={`Fan page preview for @${artistSlug}`}
              src={previewPath}
              className={cn(
                'min-h-[520px] w-full rounded-md border border-border bg-background',
                device === 'mobile' ? 'max-w-[390px]' : 'max-w-5xl',
              )}
            />
          </div>
        )}
      </div>
    </section>
  )
}