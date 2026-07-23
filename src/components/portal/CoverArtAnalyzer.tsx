'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslations } from 'next-intl'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  validateCoverArtFile,
  SUBMISSION_COVER_MAX_BYTES,
} from '@/lib/submissions/coverArtClientValidate'
import type { CoverArtCheckStatus } from '@/lib/submissions/coverArtCheck'
import { UploadSimple, Link as LinkIcon } from '@phosphor-icons/react'

interface CoverArtAnalyzerProps {
  url: string
  onVerified: (verified: boolean) => void
  /** Called when upload succeeds or user edits the remote URL field. */
  onUrlChange?: (url: string) => void
  /** When true, auto-check remote URLs after debounce. */
  autoCheck?: boolean
}

type UiState =
  | 'idle'
  | 'verifying'
  | 'uploading'
  | CoverArtCheckStatus
  | 'upload_ok'
  | 'client_wrong_size'
  | 'client_wrong_format'
  | 'client_too_large'
  | 'client_read_error'
  | 'upload_failed'

interface SizeInfo {
  width: number
  height: number
}

export function CoverArtAnalyzer({
  url,
  onVerified,
  onUrlChange,
  autoCheck = true,
}: CoverArtAnalyzerProps) {
  const t = useTranslations('portal')
  const [state, setState] = useState<UiState>('idle')
  const [sizeInfo, setSizeInfo] = useState<SizeInfo | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showUrlField, setShowUrlField] = useState(Boolean(url.trim()))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastCheckedUrl = useRef<string>('')
  const requestIdRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewObjectUrlRef = useRef<string | null>(null)
  const onVerifiedRef = useRef(onVerified)
  onVerifiedRef.current = onVerified

  const clearLocalPreview = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
    }
    setPreviewUrl(null)
  }, [])

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current)
      }
    }
  }, [])

  const verifyRemoteUrl = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    const requestId = ++requestIdRef.current
    setState('verifying')
    onVerifiedRef.current(false)
    setSizeInfo(null)

    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (requestId !== requestIdRef.current) return
      if (!session?.access_token) {
        setState('fetch_failed')
        return
      }

      const res = await fetch('/api/portal/cover-art-check', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: trimmed }),
      })

      if (requestId !== requestIdRef.current) return

      if (!res.ok) {
        setState('fetch_failed')
        onVerifiedRef.current(false)
        return
      }

      const data = (await res.json()) as {
        status: CoverArtCheckStatus
        verified: boolean
        width?: number
        height?: number
      }

      if (requestId !== requestIdRef.current) return

      if (data.width != null && data.height != null) {
        setSizeInfo({ width: data.width, height: data.height })
      }

      lastCheckedUrl.current = trimmed
      setState(data.status)
      onVerifiedRef.current(data.verified === true)
      if (data.verified) {
        clearLocalPreview()
        setPreviewUrl(trimmed)
      }
    } catch {
      if (requestId !== requestIdRef.current) return
      setState('fetch_failed')
      onVerifiedRef.current(false)
    }
  }, [url, clearLocalPreview])

  useEffect(() => {
    if (!autoCheck || !showUrlField) return
    const trimmed = url.trim()
    if (!trimmed) {
      requestIdRef.current += 1
      lastCheckedUrl.current = ''
      if (state !== 'upload_ok') {
        setState('idle')
        onVerifiedRef.current(false)
      }
      return
    }
    if (trimmed === lastCheckedUrl.current) return
    // Skip auto remote check for URLs we just uploaded (already verified client-side)
    if (state === 'upload_ok' && trimmed === lastCheckedUrl.current) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void verifyRemoteUrl()
    }, 700)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [url, autoCheck, showUrlField, verifyRemoteUrl, state])

  const handleFileSelect = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return

    setState('verifying')
    onVerifiedRef.current(false)
    setSizeInfo(null)
    clearLocalPreview()

    const clientResult = await validateCoverArtFile(file)
    if (!clientResult.verified) {
      if (clientResult.width != null && clientResult.height != null) {
        setSizeInfo({ width: clientResult.width, height: clientResult.height })
      }
      const map: Record<string, UiState> = {
        wrong_format: 'client_wrong_format',
        wrong_size: 'client_wrong_size',
        too_large: 'client_too_large',
        read_error: 'client_read_error',
      }
      setState(map[clientResult.status] ?? 'client_read_error')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setSizeInfo({
      width: clientResult.width ?? 3000,
      height: clientResult.height ?? 3000,
    })

    // Local preview immediately after client validation
    const localPreview = URL.createObjectURL(file)
    previewObjectUrlRef.current = localPreview
    setPreviewUrl(localPreview)

    setState('uploading')
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setState('upload_failed')
        clearLocalPreview()
        return
      }

      const body = new FormData()
      body.append('file', file)

      const res = await fetch('/api/portal/upload-release-cover', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body,
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setState('upload_failed')
        onVerifiedRef.current(false)
        clearLocalPreview()
        console.error('[cover upload]', err.error ?? res.status)
        return
      }

      const data = (await res.json()) as { url?: string }
      if (!data.url) {
        setState('upload_failed')
        onVerifiedRef.current(false)
        clearLocalPreview()
        return
      }

      lastCheckedUrl.current = data.url
      setState('upload_ok')
      onVerifiedRef.current(true)
      onUrlChange?.(data.url)
      // Prefer CDN URL for preview after upload
      clearLocalPreview()
      setPreviewUrl(data.url)
    } catch {
      setState('upload_failed')
      onVerifiedRef.current(false)
      clearLocalPreview()
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const getMessage = (): string => {
    switch (state) {
      case 'ok':
      case 'upload_ok':
        return t('releases_submit_cover_check_ok')
      case 'wrong_size':
      case 'client_wrong_size': {
        return t('releases_submit_cover_check_wrong_size')
          .replace('{{width}}', String(sizeInfo?.width ?? '?'))
          .replace('{{height}}', String(sizeInfo?.height ?? '?'))
      }
      case 'wrong_format':
      case 'client_wrong_format':
        return t('releases_submit_cover_check_wrong_format')
      case 'forbidden_host':
      case 'invalid_url':
        return t('releases_submit_cover_check_blocked')
      case 'not_image':
      case 'fetch_failed':
        return t('releases_submit_cover_check_drive_help')
      case 'too_large':
      case 'client_too_large':
        return t('releases_submit_cover_check_too_large')
      case 'client_read_error':
        return t('releases_submit_cover_upload_read_error')
      case 'upload_failed':
        return t('releases_submit_cover_upload_failed')
      case 'verifying':
        return t('releases_submit_cover_check_verifying')
      case 'uploading':
        return t('releases_submit_cover_uploading')
      default:
        return ''
    }
  }

  const isBusy = state === 'verifying' || state === 'uploading'
  const isSuccess = state === 'ok' || state === 'upload_ok'
  const badgeVariant = isSuccess
    ? 'default'
    : isBusy
      ? 'secondary'
      : state === 'idle'
        ? 'outline'
        : 'destructive'

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t('releases_submit_cover_check_heading')}</p>
      <p className="text-xs text-muted-foreground">{t('releases_submit_cover_upload_hint')}</p>

      <div className="flex flex-wrap items-start gap-4">
        {previewUrl && isSuccess && (
          <div
            role="img"
            aria-label={t('releases_submit_cover_check_heading')}
            className="h-24 w-24 shrink-0 rounded-md border border-border bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(previewUrl)})` }}
          />
        )}

        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,.jpg,.jpeg"
            className="sr-only"
            id="cover-art-file-input"
            disabled={isBusy}
            onChange={(e) => void handleFileSelect(e.target.files)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadSimple className="mr-1.5 h-4 w-4" aria-hidden />
              {isBusy
                ? state === 'uploading'
                  ? t('releases_submit_cover_uploading')
                  : t('releases_submit_cover_check_verifying')
                : t('releases_submit_cover_upload_button')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => setShowUrlField((v) => !v)}
            >
              <LinkIcon className="mr-1.5 h-4 w-4" aria-hidden />
              {showUrlField
                ? t('releases_submit_cover_hide_url')
                : t('releases_submit_cover_use_url')}
            </Button>
            {state !== 'idle' && (
              <Badge variant={badgeVariant} className="text-xs max-w-full whitespace-normal">
                {getMessage()}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t('releases_submit_cover_upload_specs', {
              maxMb: String(Math.round(SUBMISSION_COVER_MAX_BYTES / (1024 * 1024))),
            })}
          </p>
        </div>
      </div>

      {showUrlField && (
        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
          <Label htmlFor="cover-art-url-fallback" className="text-xs">
            {t('releases_submit_cover_url_fallback')}
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="cover-art-url-fallback"
              type="url"
              value={url}
              disabled={isBusy}
              placeholder="https://drive.google.com/..."
              onChange={(e) => {
                lastCheckedUrl.current = ''
                onVerifiedRef.current(false)
                setState('idle')
                clearLocalPreview()
                onUrlChange?.(e.target.value)
              }}
              className="flex-1 min-w-[12rem]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!url.trim() || isBusy}
              onClick={() => void verifyRemoteUrl()}
            >
              {state === 'verifying'
                ? t('releases_submit_cover_check_verifying')
                : t('releases_submit_cover_check_button')}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('releases_submit_cover_check_hint')}</p>
        </div>
      )}
    </div>
  )
}
