'use client'

/**
 * Lightweight setup / repair checklist for Supabase Cron (no Vercel Cron).
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Warning, Copy } from '@phosphor-icons/react'
import { toast } from 'sonner'
import Link from 'next/link'

export interface SyncSetupChecklistProps {
  cronSecretConfigured: boolean
  executorOk: boolean
  youtubeConfigured: boolean
  youtubeOk: boolean
}

function Row({
  ok,
  title,
  detail,
}: {
  ok: boolean
  title: string
  detail: string
}) {
  return (
    <li className="flex gap-2 text-sm border border-border rounded-md px-3 py-2">
      {ok ? (
        <CheckCircle size={18} weight="fill" className="text-green-400 shrink-0 mt-0.5" aria-hidden />
      ) : (
        <Warning size={18} weight="fill" className="text-yellow-400 shrink-0 mt-0.5" aria-hidden />
      )}
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
      </div>
    </li>
  )
}

const CRON_SNIPPETS = [
  { label: 'process-queue (every 5m)', path: '/trigger-sync?type=process-queue', schedule: '*/5 * * * *' },
  { label: 'daily full enqueue', path: '/trigger-sync?type=all', schedule: '0 3 * * *' },
  { label: 'YouTube channel', path: '/trigger-sync?type=youtube', schedule: '0 6 * * *' },
]

export function SyncSetupChecklist({
  cronSecretConfigured,
  executorOk,
  youtubeConfigured,
  youtubeOk,
}: SyncSetupChecklistProps) {
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`Copied to clipboard`)
    } catch {
      toast.error(`Copy failed`)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Sync setup (Supabase Cron)</CardTitle>
        <CardDescription>
          Scheduling uses Supabase Cron → Edge Function <code className="text-xs">trigger-sync</code>{' '}
          → this site. Vercel Cron is not used (Hobby-compatible).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          <Row
            ok={cronSecretConfigured}
            title="CRON_SECRET on the site"
            detail={
              cronSecretConfigured
                ? 'Present — Edge Function secrets must use the same value.'
                : 'Missing — set CRON_SECRET in Vercel env and on the trigger-sync Edge Function.'
            }
          />
          <Row
            ok={executorOk}
            title="Queue executor (process-queue)"
            detail={
              executorOk
                ? 'Recent heartbeat — /api/sync is being invoked.'
                : 'No recent executor heartbeat. Create Supabase Cron for type=process-queue every 5 minutes.'
            }
          />
          <Row
            ok={youtubeConfigured && youtubeOk}
            title="YouTube channel sync"
            detail={
              !youtubeConfigured
                ? 'Add youtube_api_key + youtube_channel_id under API Keys, then schedule type=youtube daily.'
                : youtubeOk
                  ? 'Configured and heartbeat present.'
                  : 'Credentials set, but no YouTube heartbeat yet — schedule or run YouTube sync.'
            }
          />
        </ul>

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Recommended Supabase Cron jobs</p>
          <ul className="space-y-2">
            {CRON_SNIPPETS.map((item) => (
              <li
                key={item.path}
                className="flex flex-wrap items-center gap-2 text-xs border border-border rounded-md px-3 py-2"
              >
                <span className="font-medium">{item.label}</span>
                <code className="text-muted-foreground">{item.schedule}</code>
                <code className="text-muted-foreground break-all">{item.path}</code>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 ml-auto"
                  onClick={() => void copy(item.path)}
                  aria-label={`Copy path for ${item.label}`}
                >
                  <Copy size={14} aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Edge secrets: <code>SITE_URL</code> (production URL) and <code>CRON_SECRET</code> (same as
            Vercel).{' '}
            <Link href="/admin/api-keys" className="text-primary underline-offset-2 hover:underline">
              API Keys
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
