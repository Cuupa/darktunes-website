'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { uploadReleaseSubmissionAsset } from '@/lib/submissions/uploadReleaseSubmissionAsset'
import { formatUploadMb, PORTAL_RELEASE_AUDIO_MAX_BYTES } from '@/lib/submissions/submissionAssets'
import { PORTAL_RELEASE_COVER_MAX_BYTES } from '@/lib/uploads/portalUploadLimits'

interface SubmissionAssetFieldProps {
  kind: 'audio' | 'cover'
  artistId: string
  label: string
  required?: boolean
  fileName?: string | null
  error?: string | null
  onUploaded: (r2Key: string, file: File) => void
}

export function SubmissionAssetField({
  kind,
  artistId,
  label,
  required,
  fileName,
  error,
  onUploaded,
}: SubmissionAssetFieldProps) {
  const t = useTranslations('portal')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const maxBytes = kind === 'cover' ? PORTAL_RELEASE_COVER_MAX_BYTES : PORTAL_RELEASE_AUDIO_MAX_BYTES
  const accept = kind === 'cover' ? 'image/jpeg,.jpg,.jpeg' : '.zip,.wav,.flac,.aiff,.aif,.mp3,audio/*,application/zip'

  return (
    <div className="space-y-2">
      <Label htmlFor={`asset-${kind}`}>
        {label}
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </Label>
      <Input
        id={`asset-${kind}`}
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setLocalError(null)
          setBusy(true)
          void (async () => {
            try {
              const supabase = createBrowserSupabaseClient()
              const {
                data: { session },
              } = await supabase.auth.getSession()
              if (!session?.access_token) {
                setLocalError(t('releases_submit_error'))
                return
              }
              const result = await uploadReleaseSubmissionAsset({
                artistId,
                kind,
                file,
                accessToken: session.access_token,
              })
              onUploaded(result.r2_key, file)
            } catch (err) {
              setLocalError(err instanceof Error ? err.message : t('releases_submit_error'))
            } finally {
              setBusy(false)
            }
          })()
        }}
      />
      <p className="text-xs text-muted-foreground">
        {kind === 'cover'
          ? t('releases_submit_cover_upload_hint', { limit: formatUploadMb(maxBytes) })
          : t('releases_submit_audio_upload_hint', { limit: formatUploadMb(maxBytes) })}
      </p>
      {fileName ? (
        <p className="text-xs text-foreground">{t('releases_submit_file_ready', { name: fileName })}</p>
      ) : null}
      {busy ? <p className="text-xs text-muted-foreground">{t('releases_submit_uploading')}</p> : null}
      {(localError || error) && (
        <p className="text-xs text-destructive" role="alert">
          {localError ?? error}
        </p>
      )}
    </div>
  )
}
