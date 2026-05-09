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

const schema = z.object({
  email: z.string().email('Bitte eine gültige E-Mail-Adresse eingeben'),
  name: z.string().max(120).optional(),
})

type FormData = z.infer<typeof schema>

/**
 * NewsletterSection — GDPR-compliant opt-in form.
 *
 * Submits to /api/newsletter (Next.js Route Handler) — never directly to the
 * email provider. The user's data is stored in Supabase and optionally synced
 * to MailerLite server-side.
 */
export function NewsletterSection() {
  const [submitted, setSubmitted] = useState(false)

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
      toast.error(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.')
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
          <h2 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight uppercase">Newsletter</h2>
          <p className="text-lg text-muted-foreground font-serif max-w-md mx-auto">
            Bleib auf dem Laufenden – neue Releases, Tourdaten und exklusive Inhalte direkt in deinem Postfach.
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
              <p className="text-lg font-semibold text-foreground mb-2">Danke für deine Anmeldung! 🎉</p>
              <p className="text-muted-foreground text-sm">
                Du erhältst in Kürze eine Bestätigungsmail.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="nl-name" className="sr-only">Name (optional)</Label>
                  <Input
                    id="nl-name"
                    placeholder="Name (optional)"
                    {...register('name')}
                    disabled={isSubmitting}
                    className="bg-card border-border"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="nl-email" className="sr-only">E-Mail-Adresse *</Label>
                  <Input
                    id="nl-email"
                    type="email"
                    placeholder="deine@email.de"
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
                  {isSubmitting ? 'Anmelden…' : (
                    <>
                      Anmelden
                      <ArrowRight size={16} weight="bold" className="ml-2" />
                    </>
                  )}
                </Button>
              </div>

              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Mit der Anmeldung stimmst du zu, gelegentlich E-Mails von darkTunes zu erhalten.
                Du kannst dich jederzeit abmelden.{' '}
                <a href="/datenschutz" className="underline hover:text-accent transition-colors">
                  Datenschutzerklärung
                </a>
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  )
}
