'use client'

/**
 * app/account/privacy/_components/PrivacyClient.tsx
 *
 * Client-side panel for GDPR self-service controls.
 * - "Export My Data" downloads /api/account/export
 * - "Delete Account" navigates to /account/delete
 */

import { useState } from 'react'
import Link from 'next/link'
import { DownloadSimple, Trash, ShieldCheck } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface Props {
  email: string
}

export function PrivacyClient({ email }: Props) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? 'Export failed')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? 'darktunes-data-export.json'

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      toast.success('Your data export is ready.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck size={28} className="text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">Privacy &amp; Data</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      <Separator />

      {/* Export section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DownloadSimple size={18} aria-hidden="true" />
            Export My Data
          </CardTitle>
          <CardDescription>
            Download a complete JSON archive of all personal data we hold for your account —
            including your profile, releases, messages, and tour dates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={isExporting} variant="outline">
            {isExporting ? 'Preparing export…' : 'Download My Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Delete section */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Trash size={18} aria-hidden="true" />
            Delete My Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action cannot be
            undone. Admin accounts cannot be deleted via self-service.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" asChild>
            <Link href="/account/delete">Delete Account…</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
