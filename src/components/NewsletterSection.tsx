'use client'

import { useState, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Envelope, ArrowRight } from '@phosphor-icons/react'
import type { Dictionary } from '@/i18n/types'
import { subscribeToNewsletter } from '@/actions/newsletter'

interface NewsletterSectionProps {
  dict: Dictionary['newsletter']
}

type FormData = { email: string; name?: string }

/**
 * NewsletterSection — GDPR-compliant Double Opt-In subscription form.
 *
 * Submits via the `subscribeToNewsletter` Server Action — never calls an
 * external API directly from the browser. The Server Action stores the
 * subscriber as 'pending' in Supabase; a Supabase Edge Function then sends
 * the confirmation email asynchronously.
 */
export function NewsletterSection({ dict }: NewsletterSectionProps) {
  const [submitted, setSubmitted] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  // Build schema with translated error message — memoised to avoid re-creation on every render
  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email(dict.validationEmail),
        name: z.string().max(120).optional(),
      }),
    [dict.validationEmail],
  )

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    const formData = new FormData()
    formData.set('email', data.email)
    if (data.name) formData.set('name', data.name)

    const result = await subscribeToNewsletter(formData)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setSubmitted(true)
  }

  return (
    <section id="newsletter" className="py-24 px-4 lg:px-16 bg-gradient-to-b from-muted/20 to-primary/5">
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
          <h2 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight uppercase">{dict.heading}</h2>
          <p className="text-lg text-muted-foreground font-serif max-w-md mx-auto">
            {dict.description}
          </p>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : 0.15 }}
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
                  className="shrink-0 bg-gradient-to-r from-primary to-secondary hover:opacity-90 hover:shadow-[0_0_20px_rgba(73,54,135,0.5)] text-white font-semibold transition-all duration-300"
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
