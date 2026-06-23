'use client'

import { Envelope } from '@phosphor-icons/react'
import { ScrollReveal } from '@/components/animations/ScrollReveal'
import type { Dictionary } from '@/i18n/types'

interface NewsletterSectionProps {
  dict: Dictionary['newsletter']
}

/**
 * NewsletterSection — embeds the darkmerch.com Shopify newsletter signup
 * page directly via an iframe. The CSP frame-src in next.config.ts
 * explicitly allows https://darkmerch.com so the embed is permitted.
 */
export function NewsletterSection({ dict }: NewsletterSectionProps) {
  return (
    <section id="newsletter" className="py-24 px-4 lg:px-16">
      <div className="container mx-auto max-w-2xl">
        <ScrollReveal className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 ring-1 ring-primary/20 mb-5 shadow-[0_0_20px_rgba(73,54,135,0.3)]">
            <Envelope size={28} weight="fill" className="text-primary" />
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight uppercase">
            {dict.heading}
          </h2>
          <p className="text-lg text-muted-foreground font-serif max-w-md mx-auto">
            {dict.description}
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.15} className="relative rounded-sm border border-border overflow-hidden bg-card"
          style={{ boxShadow: '0 0 40px rgba(73,54,135,0.15)' }}
        >
          {/* Subtle top accent line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent z-10" aria-hidden="true" />

          <iframe
            src="https://darkmerch.com/pages/newsletter"
            title={dict.heading}
            width="100%"
            height="260"
            loading="lazy"
            scrolling="no"
            className="block w-full border-0"
          />
        </ScrollReveal>
      </div>
    </section>
  )
}
