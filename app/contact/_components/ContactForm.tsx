'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { Dictionary } from '@/i18n/types'
import type { ContactTopicConfig } from '@/types'
import type { Locale } from '@/i18n/types'

/** Built-in fallback topics used when no custom topics are configured. */
const DEFAULT_TOPICS: ContactTopicConfig[] = [
  { value: 'label', label_de: 'Label', label_en: 'Label' },
  { value: 'shop', label_de: 'Shop', label_en: 'Shop' },
  { value: 'booking', label_de: 'Booking', label_en: 'Booking' },
  { value: 'other', label_de: 'Sonstiges', label_en: 'Other' },
]

interface FormState {
  name: string
  email: string
  topic: string
  message: string
  gdprConsent: boolean
  website: string
}

type Status = 'idle' | 'submitting' | 'success' | 'error'

interface ContactFormProps {
  dict: Dictionary['contact']
  locale: Locale
  contactTopics: ContactTopicConfig[]
}

export function ContactForm({ dict, locale, contactTopics }: ContactFormProps) {
  const topics = contactTopics.length > 0 ? contactTopics : DEFAULT_TOPICS
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    topic: topics[0]?.value ?? 'other',
    message: '',
    gdprConsent: false,
    website: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [status, setStatus] = useState<Status>('idle')

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) next.name = dict.validationName
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = dict.validationEmail
    if (form.message.trim().length < 20) next.message = dict.validationMessage
    if (!form.gdprConsent) next.gdprConsent = dict.validationConsent
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setStatus('submitting')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          topic: form.topic,
          message: form.message,
          gdprConsent: form.gdprConsent,
          website: form.website,
        }),
      })
      if (!res.ok) throw new Error('server error')
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-8 text-center space-y-2">
        <p className="text-2xl font-bold">{dict.successTitle}</p>
        <p className="text-muted-foreground font-serif">{dict.successMessage}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none h-0 w-0 overflow-hidden"
        autoComplete="off"
      />

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="contact-name">{dict.nameLabel}</Label>
          <Input
            id="contact-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={dict.namePlaceholder}
            autoComplete="name"
            className={errors.name ? 'border-red-500' : ''}
          />
          {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-email">{dict.emailLabel}</Label>
          <Input
            id="contact-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder={dict.emailPlaceholder}
            autoComplete="email"
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-topic">{dict.topicLabel}</Label>
        <select
          id="contact-topic"
          value={form.topic}
          onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {topics.map((t) => (
            <option key={t.value} value={t.value}>
              {locale === 'de' ? t.label_de : t.label_en}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message">{dict.messageLabel}</Label>
        <Textarea
          id="contact-message"
          rows={6}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          placeholder={dict.messagePlaceholder}
          className={errors.message ? 'border-red-500' : ''}
        />
        {errors.message && <p className="text-xs text-red-400">{errors.message}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="contact-gdpr"
            checked={form.gdprConsent}
            onCheckedChange={(checked) =>
              setForm((f) => ({ ...f, gdprConsent: checked === true }))
            }
            className={errors.gdprConsent ? 'border-red-500' : ''}
          />
          <Label htmlFor="contact-gdpr" className="text-sm text-muted-foreground leading-snug cursor-pointer">
            {dict.gdprConsent}
          </Label>
        </div>
        {errors.gdprConsent && <p className="text-xs text-red-400">{errors.gdprConsent}</p>}
      </div>

      {status === 'error' && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-400">{dict.errorTitle}</p>
          <p className="text-xs text-muted-foreground">{dict.errorMessage}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold uppercase tracking-wider"
      >
        {status === 'submitting' ? dict.submitting : dict.submit}
      </Button>

      <p className="text-xs text-muted-foreground/60 text-center">{dict.spamDisclaimer}</p>
    </form>
  )
}
