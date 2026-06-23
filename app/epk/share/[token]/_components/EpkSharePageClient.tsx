'use client'

/**
 * app/epk/share/[token]/_components/EpkSharePageClient.tsx
 *
 * Public password-gated EPK share viewer.
 */

import { useCallback, useEffect, useState } from 'react'
import { FilePdf, Lock } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EpkPublicViewer } from '@/components/epk-builder/EpkPublicViewer'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { toast } from 'sonner'

interface EpkSharePageClientProps {
  token: string
  artistName: string
  hasPassword: boolean
  linkLabel: string | undefined
}

export function EpkSharePageClient({
  token,
  artistName,
  hasPassword,
  linkLabel,
}: EpkSharePageClientProps) {
  const [password, setPassword] = useState('')
  const [unlocked, setUnlocked] = useState(!hasPassword)
  const [epkDocument, setEpkDocument] = useState<EpkDocumentV2 | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const unlock = useCallback(async (pw?: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/epk/share/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw ?? (password || undefined) }),
      })
      if (!res.ok) {
        if (res.status === 401) {
          toast.error('Invalid password')
          return
        }
        throw new Error('unlock failed')
      }
      const data = (await res.json()) as { document: EpkDocumentV2 }
      setEpkDocument(data.document)
      setUnlocked(true)
    } catch {
      toast.error('Could not load press kit')
    } finally {
      setLoading(false)
    }
  }, [password, token])

  useEffect(() => {
    if (hasPassword) return
    void unlock('')
  }, [hasPassword, unlock])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/epk/share/${token}?action=export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password || undefined }),
      })
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${artistName.replace(/\s+/g, '-').toLowerCase()}-epk.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch {
      toast.error('PDF export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-primary">Shared Press Kit</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{artistName}</h1>
          {linkLabel && <p className="text-muted-foreground">{linkLabel}</p>}
        </header>

        {!unlocked ? (
          <div className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock size={20} aria-hidden="true" />
              <p className="text-sm">This press kit is password protected.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="share-password">Password</Label>
              <Input
                id="share-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button
              type="button"
              className="min-h-[44px] w-full"
              disabled={loading || password.length < 1}
              onClick={() => void unlock()}
            >
              {loading ? 'Unlocking…' : 'View press kit'}
            </Button>
          </div>
        ) : (
          <>
            {epkDocument ? (
              <EpkPublicViewer document={epkDocument} artistName={artistName} />
            ) : (
              <p className="text-center text-muted-foreground">Loading press kit…</p>
            )}
            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                className="min-h-[44px]"
                disabled={exporting}
                onClick={() => void handleExport()}
              >
                <FilePdf size={18} className="mr-2" aria-hidden="true" />
                {exporting ? 'Generating PDF…' : 'Download PDF'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}