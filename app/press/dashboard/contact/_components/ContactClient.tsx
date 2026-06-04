'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary } from '@/i18n/types'
import { sendPressInquiry } from '../_actions/sendInquiry'

export function ContactClient({
  dict,
  userId,
  userEmail,
}: {
  dict: Dictionary['pressContact']
  userId: string
  userEmail: string
}) {
  const [subject, setSubject] = useState<'interview' | 'reviewCopy' | 'accreditation' | 'general'>('interview')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await sendPressInquiry({
        subject: dict.subjects[subject],
        body: `From ${userEmail} (${userId})\n\n${message}`,
      })
      if (!result.success) {
        toast.error('Failed to send inquiry')
        return
      }
      setMessage('')
      toast.success(dict.sent)
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{dict.heading}</h1>
      <Card className="border-border bg-card/70">
        <CardHeader>
          <CardTitle>{userEmail}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="press-contact-subject">{dict.subjectLabel}</Label>
              <Select value={subject} onValueChange={(value) => setSubject(value as typeof subject)}>
                <SelectTrigger id="press-contact-subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interview">{dict.subjects.interview}</SelectItem>
                  <SelectItem value="reviewCopy">{dict.subjects.reviewCopy}</SelectItem>
                  <SelectItem value="accreditation">{dict.subjects.accreditation}</SelectItem>
                  <SelectItem value="general">{dict.subjects.general}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="press-contact-message">{dict.messageLabel}</Label>
              <Textarea
                id="press-contact-message"
                rows={8}
                placeholder={dict.messagePlaceholder}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isPending}>{isPending ? dict.sending : dict.send}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
