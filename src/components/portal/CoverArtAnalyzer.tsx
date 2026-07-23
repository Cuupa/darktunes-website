'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { CoverArtCheckStatus } from '@/lib/submissions/coverArtCheck'

interface CoverArtAnalyzerProps {
  url: string
  onVerified: (verified: boolean) => void
  /** When true, re-check automatically after the URL settles (debounced). */
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
  const [sizeInfo, setSizeInfo] = useState<SizeInfo | null>(null)
  const lastCheckedUrl = useRef<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const verify = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setState('verifying')
    onVerified(false)
    setSizeInfo(null)

    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
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

      if (!res.ok) {
        setState('fetch_failed')
        return
      }

      const data = (await res.json()) as {
        status: CoverArtCheckStatus
        verified: boolean
        width?: number
        height?: number
      }

      if (data.width != null && data.height != null) {
        setSizeInfo({ width: data.width, height: data.height })
      }

      lastCheckedUrl.current = trimmed
      setState(data.status)
      onVerified(data.verified === true)
    } catch {
      setState('fetch_failed')
      onVerified(false)
    }
  }, [url, onVerified])

  useEffect(() => {
    if (!autoCheck) return
    const trimmed = url.trim()
    if (!trimmed) {
      setState('idle')
      onVerified(false)
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
  }, [url, autoCheck, verify, onVerified])

  const getMessage = (): string => {
    switch (state) {
      case 'ok':
        return t('releases_submit_cover_check_ok')
      case 'wrong_size': {
        return t('releases_submit_cover_check_wrong_size')
          .replace('{{width}}', String(sizeInfo?.width ?? '?'))
          .replace('{{height}}', String(sizeInfo?.height ?? '?'))
      }
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
      case 'verifying':
        return t('releases_submit_cover_check_verifying')
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
