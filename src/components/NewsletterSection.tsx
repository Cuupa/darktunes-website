'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Envelope, ArrowRight } from '@phosphor-icons/react'
import type { Dictionary } from '@/i18n/types'

interface NewsletterSectionProps {
  dict: Dictionary['newsletter']
}

type FormData = { email: string; name?: string }

/**
 * NewsletterSection — GDPR-compliant opt-in form.
 *
 * Submits to /api/newsletter (Next.js Route Handler) — never directly to the
 * email provider. The user's data is stored in Supabase and optionally synced
 * to MailerLite server-side.
 */
export function NewsletterSection({ dict }: NewsletterSectionProps) {
  const [submitted, setSubmitted] = useState(false)

  // Build schema with translated error message
  const schema = z.object({
    email: z.string().email(dict.validationEmail),
    name: z.string().max(120).optional(),
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error ?? 'Subscription failed')
      }

      setSubmitted(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.validationEmail)
    }
  }

  return (
    <section id="newsletter" className="py-24 px-4 lg:px-16 bg-muted/20">
      <div className="container mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/20 mb-5">
            <Envelope size={28} weight="fill" className="text-primary" />
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight uppercase">{dict.heading}</h2>
          <p className="text-lg text-muted-foreground font-serif max-w-md mx-auto">
            {dict.description}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {submitted ? (
            <div className="text-center py-8">
              <p className="text-lg font-semibold text-foreground mb-2">{dict.successTitle}</p>
              <p className="text-muted-foreground text-sm">
                {dict.successMessage}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="nl-name" className="sr-only">{dict.namePlaceholder}</Label>
                  <Input
                    id="nl-name"
                    placeholder={dict.namePlaceholder}
                    {...register('name')}
                    disabled={isSubmitting}
                    className="bg-card border-border"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="nl-email" className="sr-only">{dict.emailLabel}</Label>
                  <Input
                    id="nl-email"
                    type="email"
                    placeholder={dict.emailPlaceholder}
                    {...register('email')}
                    disabled={isSubmitting}
                    className={`bg-card border-border ${errors.email ? 'border-destructive' : ''}`}
                    aria-invalid={!!errors.email}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  {isSubmitting ? dict.submitting : (
                    <>
                      {dict.submit}
                      <ArrowRight size={16} weight="bold" className="ml-2" />
                    </>
                  )}
                </Button>
              </div>

              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}

              <p className="text-xs text-muted-foreground text-center">
                {dict.consentText}{' '}
                <a href="/datenschutz" className="underline hover:text-accent transition-colors">
                  {dict.privacyLink}
                </a>
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  )
}
