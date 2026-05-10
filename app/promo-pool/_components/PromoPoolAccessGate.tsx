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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary } from '@/i18n/types'
import type { JournalistApplication } from '@/lib/api/journalistApplications'

interface Props {
  dict: Dictionary['promoPool']
  application: JournalistApplication | null
  userEmail: string
}

function ApplicationStatusCard({
  dict,
  application,
}: {
  dict: Dictionary['promoPool']
  application: JournalistApplication
}) {
  const isPending = application.status === 'pending'
  const isApproved = application.status === 'approved'

  return (
    <Card className="bg-card border-border max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          {isPending && <HourglassMedium size={24} className="text-muted-foreground" weight="bold" />}
          {isApproved && <CheckCircle size={24} className="text-green-500" weight="bold" />}
          {!isPending && !isApproved && <XCircle size={24} className="text-destructive" weight="bold" />}
          <CardTitle>{dict.accessDenied}</CardTitle>
        </div>
        <CardDescription>
          {isPending ? dict.applicationPending : dict.accessDeniedMessage}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

function ApplicationForm({
  dict,
  userEmail,
}: {
  dict: Dictionary['promoPool']
  userEmail: string
}) {
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
        {dict.login.applySuccess}
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div className="space-y-1">
        <Label htmlFor="apply-name">{dict.login.applyName}</Label>
        <Input
          id="apply-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="bg-background border-input"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="apply-email">{dict.login.email}</Label>
        <Input
          id="apply-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={dict.login.applyEmailPlaceholder}
          required
          className="bg-background border-input"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="apply-outlet">{dict.login.applyOutlet}</Label>
        <Input
          id="apply-outlet"
          value={outlet}
          onChange={(e) => setOutlet(e.target.value)}
          required
          className="bg-background border-input"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="apply-message">{dict.login.applyMessage}</Label>
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
          {dict.login.applyError}
        </p>
      )}
      <Button type="submit" disabled={submitting} className="gap-2">
        {submitting ? dict.login.applySubmitting : dict.login.applySubmit}
      </Button>
    </form>
  )
}

export function PromoPoolAccessGate({ dict, application, userEmail }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-2xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{dict.heading}</h1>
          <p className="text-muted-foreground">{dict.accessDeniedMessage}</p>
        </header>

        {application ? (
          <ApplicationStatusCard dict={dict} application={application} />
        ) : (
          <>
            <p className="text-muted-foreground">{dict.applicationApply}</p>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>{dict.login.applyHeading}</CardTitle>
                <CardDescription>{dict.login.applyDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <ApplicationForm dict={dict} userEmail={userEmail} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
