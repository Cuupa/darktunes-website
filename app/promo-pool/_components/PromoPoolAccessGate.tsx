'use client'

/**
 * app/promo-pool/_components/PromoPoolAccessGate.tsx
 *
 * Shown to authenticated users who do NOT have the journalist role.
 * If they have a pending application, show its status.
 * If no application exists, show the application form.
 */

import { useState } from 'react'
import { HourglassMedium, CheckCircle, XCircle } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { JournalistApplication } from '@/lib/api/journalistApplications'

interface Props {
  application: JournalistApplication | null
  userEmail: string
}

function ApplicationStatusCard({
  application,
}: {
  application: JournalistApplication
}) {
  const t = useTranslations('promoPool')
  const isPending = application.status === 'pending'
  const isApproved = application.status === 'approved'

  return (
    <Card className="bg-card border-border max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          {isPending && <HourglassMedium size={24} className="text-muted-foreground" weight="bold" />}
          {isApproved && <CheckCircle size={24} className="text-green-500" weight="bold" />}
          {!isPending && !isApproved && <XCircle size={24} className="text-destructive" weight="bold" />}
          <CardTitle>{t('accessDenied')}</CardTitle>
        </div>
        <CardDescription>
          {isPending ? t('applicationPending') : t('accessDeniedMessage')}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

function ApplicationForm({
  userEmail,
}: {
  userEmail: string
}) {
  const t = useTranslations('promoPool')
  const [name, setName] = useState('')
  const [email, setEmail] = useState(userEmail)
  const [outlet, setOutlet] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(false)
    try {
      const res = await fetch('/api/journalist-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, outlet, message }),
      })
      if (!res.ok) throw new Error('Failed')
      setSubmitted(true)
    } catch {
      setError(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <p className="text-green-400 font-medium" role="status">
        {t('login.applySuccess')}
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div className="space-y-1">
        <Label htmlFor="apply-name">{t('login.applyName')}</Label>
        <Input
          id="apply-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="bg-background border-input"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="apply-email">{t('login.email')}</Label>
        <Input
          id="apply-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('login.applyEmailPlaceholder')}
          required
          className="bg-background border-input"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="apply-outlet">{t('login.applyOutlet')}</Label>
        <Input
          id="apply-outlet"
          value={outlet}
          onChange={(e) => setOutlet(e.target.value)}
          required
          className="bg-background border-input"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="apply-message">{t('login.applyMessage')}</Label>
        <Textarea
          id="apply-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="bg-background border-input"
        />
      </div>
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {t('login.applyError')}
        </p>
      )}
      <Button type="submit" disabled={submitting} className="gap-2">
        {submitting ? t('login.applySubmitting') : t('login.applySubmit')}
      </Button>
    </form>
  )
}

export function PromoPoolAccessGate({ application, userEmail }: Props) {
  const t = useTranslations('promoPool')

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-2xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('heading')}</h1>
          <p className="text-muted-foreground">{t('accessDeniedMessage')}</p>
        </header>

        {application ? (
          <ApplicationStatusCard application={application} />
        ) : (
          <>
            <p className="text-muted-foreground">{t('applicationApply')}</p>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>{t('login.applyHeading')}</CardTitle>
                <CardDescription>{t('login.applyDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ApplicationForm userEmail={userEmail} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}