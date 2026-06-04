'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary } from '@/i18n/types'
import { submitPressApplication } from '../_actions/apply'

interface ApplyFormProps {
  dict: Dictionary['apply']
}

export function ApplyForm({ dict }: ApplyFormProps) {
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    publication: '',
    website: '',
    reason: '',
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await submitPressApplication(form)
      if (result.status === 'pending') {
        setSubmitted(true)
        return
      }
      setError(result.message === 'emailInUse' ? dict.errors.emailInUse : dict.errors.generic)
    })
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background px-4 py-12 text-foreground">
        <div className="mx-auto max-w-xl">
          <Card className="border-border bg-card/70">
            <CardHeader>
              <CardTitle>{dict.success.heading}</CardTitle>
              <CardDescription>{dict.success.message}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/press/login">{dict.success.login}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">{dict.heading}</h1>
          <p className="text-muted-foreground">{dict.subheading}</p>
        </div>
        <Card className="border-border bg-card/70">
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="apply-name">{dict.fields.name}</Label>
                  <Input id="apply-name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apply-email">{dict.fields.email}</Label>
                  <Input id="apply-email" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="apply-password">{dict.fields.password}</Label>
                  <Input id="apply-password" type="password" minLength={8} value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apply-publication">{dict.fields.publication}</Label>
                  <Input id="apply-publication" value={form.publication} onChange={(e) => setForm((v) => ({ ...v, publication: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apply-website">{dict.fields.website}</Label>
                <Input id="apply-website" value={form.website} onChange={(e) => setForm((v) => ({ ...v, website: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apply-reason">{dict.fields.reason}</Label>
                <Textarea id="apply-reason" rows={5} value={form.reason} onChange={(e) => setForm((v) => ({ ...v, reason: e.target.value }))} required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isPending}>{isPending ? dict.submitting : dict.submit}</Button>
                <Button asChild variant="outline">
                  <Link href="/press/login">{dict.success.login}</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
