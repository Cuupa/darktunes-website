'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, PaperPlaneTilt } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RichTextEditor } from '@/components/messaging/RichTextEditor'
import type { Artist } from '@/types'

interface PortalComposeClientProps {
  artistId: string
  artists: Artist[]
}

export function PortalComposeClient({ artistId, artists }: PortalComposeClientProps) {
  const t = useTranslations('portal')
  const router = useRouter()
  const backHref = `/portal/messages?artistId=${encodeURIComponent(artistId)}`

  const otherArtists = useMemo(
    () => artists.filter((a) => a.id !== artistId),
    [artists, artistId],
  )

  const [toLabel, setToLabel] = useState(false)
  const [toArtistId, setToArtistId] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSend = useCallback(async () => {
    if (!subject.trim()) {
      toast.error(t('messages_compose_subject_required'))
      return
    }
    if (!toLabel && !toArtistId) {
      toast.error(t('messages_compose_recipient_required'))
      return
    }
    if (!bodyText.trim()) {
      toast.error(t('messages_compose_body_required'))
      return
    }

    setIsSending(true)
    try {
      const res = await fetch('/api/portal/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromArtistId: artistId,
          toArtistId: toArtistId || null,
          toLabel,
          subject: subject.trim(),
          body: bodyText.trim(),
          bodyHtml: bodyHtml || null,
        }),
      })
      if (!res.ok) {
        throw new Error(((await res.json()) as { error?: string }).error ?? t('messages_compose_send_failed'))
      }
      toast.success(t('messages_compose_sent'))
      router.push(backHref)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('messages_compose_send_failed'))
    } finally {
      setIsSending(false)
    }
  }, [artistId, backHref, bodyHtml, bodyText, router, subject, t, toArtistId, toLabel])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" asChild>
        <Link href={backHref}>
          <ArrowLeft size={14} aria-hidden="true" />
          {t('messages_compose_back')}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('messages_compose_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="portal-compose-to">{t('messages_compose_to')}</Label>
            <Select
              value={toLabel ? '__label__' : toArtistId}
              onValueChange={(v) => {
                if (v === '__label__') {
                  setToLabel(true)
                  setToArtistId('')
                } else {
                  setToLabel(false)
                  setToArtistId(v)
                }
              }}
            >
              <SelectTrigger id="portal-compose-to">
                <SelectValue placeholder={t('messages_compose_recipient_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__label__">{t('messages_compose_label_recipient')}</SelectItem>
                {otherArtists.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="portal-compose-subject">{t('messages_compose_subject')}</Label>
            <Input
              id="portal-compose-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('messages_compose_subject_placeholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('messages_compose_body')}</Label>
            <RichTextEditor
              value={bodyHtml}
              onChange={(html, text) => {
                setBodyHtml(html)
                setBodyText(text)
              }}
              placeholder={t('messages_compose_body_placeholder')}
              minHeight={180}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" asChild disabled={isSending}>
              <Link href={backHref}>{t('messages_compose_cancel')}</Link>
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={isSending}
              onClick={() => void handleSend()}
            >
              <PaperPlaneTilt size={14} aria-hidden="true" />
              {isSending ? t('messages_compose_sending') : t('messages_compose_send')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
