'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Envelope } from '@phosphor-icons/react'
import type { Dictionary } from '@/i18n/types'

interface NewsletterSectionProps {
  dict: Dictionary['newsletter']
}

type FormStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * NewsletterSection — native newsletter sign-up form.
 *
 * Submits email + optional name to the darkmerch.com (Shopify) contact
 * subscribe endpoint via a no-cors fetch so the user stays on the page.
 * The response is opaque (no-cors), so we show a success message
 * unconditionally after the request is sent — Shopify processes it
 * server-side regardless of CORS restrictions.
 */
export function NewsletterSection({ dict }: NewsletterSectionProps) {
  const prefersReducedMotion = useReducedMotion()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<FormStatus>('idle')
  const [emailError, setEmailError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(dict.validationEmail)
      return
    }
    setEmailError('')
    setStatus('loading')

    try {
      const body = new URLSearchParams()
      body.append('form_type', 'subscribe')
      body.append('utf8', '✓')
      body.append('contact[email]', email)
      if (name.trim()) body.append('contact[name]', name.trim())

      // no-cors: response is opaque but Shopify processes the subscription.
      await fetch('https://darkmerch.com/contact', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="newsletter" className="py-24 px-4 lg:px-16">
      <div className="container mx-auto max-w-2xl">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 ring-1 ring-primary/20 mb-5 shadow-[0_0_20px_rgba(73,54,135,0.3)]">
            <Envelope size={28} weight="fill" className="text-primary" />
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight uppercase">
            {dict.heading}
          </h2>
          <p className="text-lg text-muted-foreground font-serif max-w-md mx-auto">
            {dict.description}
          </p>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : 0.15 }}
          className="relative rounded-sm border border-border overflow-hidden bg-card p-8"
          style={{ boxShadow: '0 0 40px rgba(73,54,135,0.15)' }}
        >
          {/* Subtle top accent line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" aria-hidden="true" />

          {status === 'success' ? (
            <div className="text-center py-8" role="status">
              <p className="text-2xl font-bold mb-2">{dict.successTitle}</p>
              <p className="text-muted-foreground">{dict.successMessage}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate aria-label={dict.heading}>
              <div className="flex flex-col gap-4">
                <div>
                  <input
                    type="text"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={dict.namePlaceholder}
                    autoComplete="name"
                    className="w-full px-4 py-3 rounded-sm bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition"
                  />
                </div>
                <div>
                  <label htmlFor="newsletter-email" className="sr-only">
                    {dict.emailLabel}
                  </label>
                  <input
                    id="newsletter-email"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (emailError) setEmailError('')
                    }}
                    placeholder={dict.emailPlaceholder}
                    required
                    autoComplete="email"
                    aria-describedby={emailError ? 'newsletter-email-error' : undefined}
                    className="w-full px-4 py-3 rounded-sm bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition"
                  />
                  {emailError && (
                    <p
                      id="newsletter-email-error"
                      role="alert"
                      className="mt-1 text-sm text-destructive"
                    >
                      {emailError}
                    </p>
                  )}
                </div>
                {status === 'error' && (
                  <p role="alert" className="text-sm text-destructive">
                    Something went wrong. Please try again.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full py-3 px-6 rounded-sm bg-primary text-white font-semibold uppercase tracking-widest hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60 transition"
                >
                  {status === 'loading' ? dict.submitting : dict.submit}
                </button>
                <p className="text-xs text-muted-foreground text-center">
                  {dict.consentText}
                </p>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  )
}
