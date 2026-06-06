'use client'

/**
 * src/components/messaging/ExternalEmailComposer.tsx
 *
 * Compose and send an email to any external email address.
 * Uses the /api/admin/send-external-email API route.
 */

import { useCallback, useState } from 'react'
import { Globe, PaperPlaneTilt, Warning } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface ExternalEmailComposerProps {
  /** Pre-fill the recipient address (e.g. when forwarding). */
  defaultTo?: string
  /** Pre-fill subject (e.g. "Fwd: …"). */
  defaultSubject?: string
  /** Pre-fill body HTML (e.g. forwarded content). */
  defaultHtml?: string
  /** Callback invoked after a successful send. */
  onSent?: () => void
}

export function ExternalEmailComposer({
  defaultTo = '',
  defaultSubject = '',
  defaultHtml = '',
  onSent,
}: ExternalEmailComposerProps) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState(defaultSubject)
  const [html, setHtml] = useState(defaultHtml)
  const [replyTo, setReplyTo] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSend = useCallback(async () => {
    if (!to.trim()) { setError('Recipient is required.'); return }
    if (!subject.trim()) { setError('Subject is required.'); return }
    if (!html.trim()) { setError('Message body is required.'); return }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/admin/send-external-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), html, replyTo: replyTo.trim() || undefined }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; hint?: string }
      if (!res.ok) {
        if (res.status === 501) {
          setError(`SMTP not configured on the server. ${data.hint ?? ''}`)
        } else {
          setError(data.error ?? 'Failed to send email')
        }
        return
      }
      toast.success(`Email sent to ${to.trim()}`)
      setOpen(false)
      setTo(defaultTo)
      setSubject(defaultSubject)
      setHtml(defaultHtml)
      setReplyTo('')
      onSent?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSending(false)
    }
  }, [to, subject, html, replyTo, defaultTo, defaultSubject, defaultHtml, onSent])

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) { setTo(defaultTo); setSubject(defaultSubject); setHtml(defaultHtml); setError('') }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Globe size={16} aria-hidden="true" />
          External Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send External Email</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="ext-to">To</Label>
            <Input
              id="ext-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ext-reply-to">Reply-To (optional)</Label>
            <Input
              id="ext-reply-to"
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="noreply@darktunes.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ext-subject">Subject</Label>
            <Input
              id="ext-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ext-body">Message</Label>
            <Textarea
              id="ext-body"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="Write your message… HTML is accepted."
              rows={8}
              className="font-mono text-sm resize-y"
            />
            <p className="text-xs text-muted-foreground">HTML is accepted. Plain text will be auto-generated.</p>
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-yellow-400">
              <Warning size={15} aria-hidden="true" /> {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Cancel</Button>
            <Button onClick={() => void handleSend()} disabled={sending} className="gap-1.5">
              <PaperPlaneTilt size={15} aria-hidden="true" />
              {sending ? 'Sending…' : 'Send Email'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
