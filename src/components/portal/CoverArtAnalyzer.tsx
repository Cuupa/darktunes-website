'use client'

/**
 * Cover art verification for release submissions.
 * Remote URLs are checked server-side (JPEG 3000×3000). No R2 storage during the form.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { coverCodeToI18nKey, type CoverArtErrorCode } from '@/lib/submissions/coverArtCodes'
import type { CoverArtCheckStatus } from '@/lib/submissions/coverArtCheck'

interface CoverArtAnalyzerProps {
  url: string
  onVerified: (verified: boolean, token?: string | null) => void
  autoCheck?: boolean
}

type UiState = 'idle' | 'verifying' | CoverArtCheckStatus

interface SizeInfo {
  width: number
  height: number
}

export function CoverArtAnalyzer({ url, onVerified, autoCheck = true }: CoverArtAnalyzerProps) {
  const t = useTranslations('portal')
  const [state, setState] = useState<UiState>('idle')
  const [code, setCode] = useState<CoverArtErrorCode | null>(null)
  const [sizeInfo, setSizeInfo] = useState<SizeInfo | null>(null)
  const lastCheckedUrl = useRef<string>('')
  const requestIdRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onVerifiedRef = useRef(onVerified)
  onVerifiedRef.current = onVerified

  const verify = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    const requestId = ++requestIdRef.current
    setState('verifying')
    setCode(null)
    onVerifiedRef.current(false, null)
    setSizeInfo(null)

    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (requestId !== requestIdRef.current) return
      if (!session?.access_token) {
        setState('fetch_failed')
        setCode('COVER_FETCH_FAILED')
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
        setCode('COVER_FETCH_FAILED')
        onVerifiedRef.current(false, null)
        return
      }

      const data = (await res.json()) as {
        status: CoverArtCheckStatus
        code?: CoverArtErrorCode
        verified: boolean
        width?: number
        height?: number
        token?: string
      }

      if (requestId !== requestIdRef.current) return

      if (data.width != null && data.height != null) {
        setSizeInfo({ width: data.width, height: data.height })
      }

      lastCheckedUrl.current = trimmed
      setState(data.status)
      setCode(data.code ?? null)
      onVerifiedRef.current(data.verified === true, data.token ?? null)
    } catch {
      if (requestId !== requestIdRef.current) return
      setState('fetch_failed')
      setCode('COVER_FETCH_FAILED')
      onVerifiedRef.current(false, null)
    }
  }, [url])

  useEffect(() => {
    if (!autoCheck) return
    const trimmed = url.trim()
    if (!trimmed) {
      requestIdRef.current += 1
      lastCheckedUrl.current = ''
      setState('idle')
      setCode(null)
      onVerifiedRef.current(false, null)
      return
    }
    if (trimmed === lastCheckedUrl.current) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void verify()
    }, 700)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [url, autoCheck, verify])

  const getMessage = (): string => {
    if (state === 'verifying') return t('releases_submit_cover_check_verifying')
    if (state === 'idle') return ''
    if (code === 'COVER_WRONG_SIZE' || state === 'wrong_size') {
      return t('releases_submit_cover_check_wrong_size')
        .replace('{{width}}', String(sizeInfo?.width ?? '?'))
        .replace('{{height}}', String(sizeInfo?.height ?? '?'))
    }
    if (code) {
      const key = coverCodeToI18nKey(code) as Parameters<typeof t>[0]
      try {
        return t(key)
      } catch {
        // fall through
      }
    }
    switch (state) {
      case 'ok':
        return t('releases_submit_cover_check_ok')
      case 'wrong_format':
        return t('releases_submit_cover_check_wrong_format')
      case 'forbidden_host':
      case 'invalid_url':
        return t('releases_submit_cover_check_blocked')
      case 'not_image':
      case 'fetch_failed':
        return t('releases_submit_cover_check_drive_help')
      case 'too_large':
        return t('releases_submit_cover_check_too_large')
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
      <p className="text-sm font-medium">{t('releases_submit_cover_check_heading')}</p>
      <p className="text-xs text-muted-foreground">{t('releases_submit_cover_check_hint')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!url.trim() || state === 'verifying'}
          onClick={() => void verify()}
        >
          {state === 'verifying'
            ? t('releases_submit_cover_check_verifying')
            : t('releases_submit_cover_check_button')}
        </Button>
        {state !== 'idle' && (
          <Badge variant={badgeVariant} className="text-xs max-w-full whitespace-normal">
            {getMessage()}
          </Badge>
        )}
      </div>
    </div>
  )
}
