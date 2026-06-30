'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FanPageEditorProvider, useFanPageEditorStore } from '@/lib/fan-page/editor/FanPageEditorProvider'
import { useFanPageAutosave } from '@/hooks/useFanPageAutosave'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { LandingPageDocumentV1, FanPagePublishStatus } from '@/lib/fan-page/schema/documentV1'
import type { Artist, Release, Concert, Video } from '@/types'
import type { FanPageLiveData } from '@/components/fan-page/FanPageBlockRenderer'

const FanPageBuilderShell = dynamic(
  () => import('@/components/fan-page/FanPageBuilderShell').then((m) => m.FanPageBuilderShell),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] animate-pulse rounded-lg border border-border bg-muted/40" />
    ),
  },
)

interface FanPageBuilderClientProps {
  artistId: string
  artist: Artist
  initialDocument: LandingPageDocumentV1
  documentVersion: number
  publishStatus: FanPagePublishStatus
  releases: Release[]
  concerts: Concert[]
  videos: Video[]
}

function FanPageBuilderWorkspace({
  artistId,
  artist,
  documentVersion: initialVersion,
  publishStatus: initialPublishStatus,
  releases,
  concerts,
  videos,
}: Omit<FanPageBuilderClientProps, 'initialDocument'>) {
  const t = useTranslations('portal')
  const document = useFanPageEditorStore((s) => s.document)
  const isDirty = useFanPageEditorStore((s) => s.isDirty)
  const markClean = useFanPageEditorStore((s) => s.markClean)
  const [documentVersion, setDocumentVersion] = useState(initialVersion)
  const [publishStatus, setPublishStatus] = useState(initialPublishStatus)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  const liveData: FanPageLiveData = {
    artist,
    releases,
    concerts,
    videos,
    smartLinks: artist.smartLinks,
  }

  const { saveStatus, saveNow } = useFanPageAutosave({
    artistId,
    document,
    isDirty,
    onMarkClean: markClean,
    onSaved: setDocumentVersion,
    saveErrorMessage: t('fanPage_save_error'),
  })

  const handlePublish = useCallback(
    async (mode: 'submit_review' | 'publish_direct') => {
      setIsPublishing(true)
      try {
        if (isDirty) await saveNow()

        const supabase = createBrowserSupabaseClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.access_token) {
          toast.error(t('fanPage_publish_auth_error'))
          return
        }

        const response = await fetch('/api/portal/fan-page/publish', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            artist_id: artistId,
            mode,
          }),
        })

        const payload = (await response.json().catch(() => null)) as {
          error?: string
          publishStatus?: FanPagePublishStatus
          warnings?: Array<{ message: string }>
        } | null

        if (!response.ok) {
          if (payload?.warnings?.length) {
            toast.error(payload.warnings.map((w) => w.message).join(' · '))
          } else {
            toast.error(payload?.error ?? t('fanPage_publish_error'))
          }
          return
        }

        if (payload?.publishStatus) setPublishStatus(payload.publishStatus)
        toast.success(t('fanPage_publish_success'))
      } catch {
        toast.error(t('fanPage_publish_error'))
      } finally {
        setIsPublishing(false)
      }
    },
    [artistId, isDirty, saveNow, t],
  )

  const handleSmartPreview = useCallback(async () => {
    setIsPreviewLoading(true)
    try {
      if (isDirty) await saveNow()

      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(t('fanPage_publish_auth_error'))
        return
      }

      const response = await fetch('/api/portal/fan-page/preview-token', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ artist_id: artistId }),
      })

      if (!response.ok) {
        toast.error(t('fanPage_preview_error'))
        return
      }

      const payload = (await response.json()) as { previewPath: string }
      window.open(payload.previewPath, '_blank', 'noopener,noreferrer')
    } finally {
      setIsPreviewLoading(false)
    }
  }, [artistId, isDirty, saveNow, t])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 px-2">
            <Link href={`/portal/profile?artistId=${artistId}`}>
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t('fanPage_back_profile')}
            </Link>
          </Button>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t('fanPage_title')}</h1>
          <p className="text-xs text-muted-foreground">
            {t('fanPage_version_label', { version: String(documentVersion) })}
          </p>
        </div>
      </div>

      <FanPageBuilderShell
        artistId={artistId}
        liveData={liveData}
        onPublish={(mode) => void handlePublish(mode)}
        onSmartPreview={handleSmartPreview}
        isPublishing={isPublishing}
        canPublishDirect={artist.landingPublishTrusted ?? false}
        publishStatus={publishStatus}
        saveStatus={saveStatus}
        isDirty={isDirty}
        isPreviewLoading={isPreviewLoading}
      />
    </div>
  )
}

export function FanPageBuilderClient({
  artistId,
  artist,
  initialDocument,
  documentVersion,
  publishStatus,
  releases,
  concerts,
  videos,
}: FanPageBuilderClientProps) {
  return (
    <FanPageEditorProvider initialDocument={initialDocument}>
      <FanPageBuilderWorkspace
        artistId={artistId}
        artist={artist}
        documentVersion={documentVersion}
        publishStatus={publishStatus}
        releases={releases}
        concerts={concerts}
        videos={videos}
      />
    </FanPageEditorProvider>
  )
}