'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Calendar } from '@phosphor-icons/react'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { NewsPost } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'
import type { SectionProps } from '@/lib/component-contracts'

interface NewsProps extends SectionProps {
  news: NewsPost[]
  dict: Dictionary['news']
  locale: Locale
}

/** Number of news items shown as a sneak peek on the homepage. */
const SNEAK_PEEK_COUNT = 3

export function News({ news, dict, locale }: NewsProps) {
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const prefersReducedMotion = useReducedMotion()
  const sneakPeek = news.slice(0, SNEAK_PEEK_COUNT)
  const hasMore = news.length > SNEAK_PEEK_COUNT
  return (
    <section id="news" className="py-24 px-4 lg:px-16 scroll-mt-36">
      <div className="container mx-auto">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
          className="mb-12 flex items-end justify-between gap-4 flex-wrap"
        >
          <div>
            <h2 className="text-5xl lg:text-6xl font-bold mb-4 tracking-tight">{dict.heading}</h2>
            <p className="text-xl text-muted-foreground font-serif">{dict.subheading}</p>
          </div>
          <Button variant="ghost" className="group/btn hover:text-accent px-0 uppercase tracking-wider font-bold" asChild>
            <Link href="/news">
              {dict.viewAll}
              <ArrowRight className="ml-2 group-hover/btn:translate-x-2 transition-transform" weight="bold" />
            </Link>
          </Button>
        </motion.div>

        <ul className="space-y-8 list-none">
          {sneakPeek.map((post, index) => (
            <motion.li
              key={post.id}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : index * 0.1 }}
            >
              <Card className="glow-card group bg-card border-border overflow-hidden hover:border-accent/50 transition-all duration-300">
                <div className="grid lg:grid-cols-[320px_1fr] gap-0">
                  {post.imageUrl && (
                    <div className="relative aspect-[16/9] lg:aspect-auto overflow-hidden">
                      <Image 
                        fill
                        src={getOptimizedImageUrl(post.imageUrl, 800)} 
                        alt={post.title}
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        sizes="(max-width: 1024px) 100vw, 320px"
                        onError={(e) => {
                          e.currentTarget.closest('.relative')?.remove()
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/20" />
                    </div>
                  )}
                  <div className="p-6 lg:p-8 flex flex-col justify-center">
                    <Badge className="self-start mb-4 bg-primary/20 text-primary-foreground border-primary/30 uppercase font-mono text-xs tracking-widest flex items-center gap-2">
                      <Calendar size={12} weight="bold" />
                      {new Date(post.publishedAt).toLocaleDateString(dateLocale, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Badge>
                    <h3 className="text-2xl lg:text-3xl font-bold mb-4 group-hover:text-accent transition-colors leading-tight">
                      {post.title}
                    </h3>
                    <p className="text-muted-foreground mb-6 font-serif leading-relaxed">
                      {post.excerpt}
                    </p>
                    <Button 
                      variant="ghost" 
                      className="self-start group/btn hover:text-accent px-0 uppercase tracking-wider font-bold"
                      asChild
                    >
                      <Link href={`/news/${post.slug}`}>
                        {dict.readFullStory}
                        <ArrowRight className="ml-2 group-hover/btn:translate-x-2 transition-transform" weight="bold" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.li>
          ))}
        </ul>

        {hasMore && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
            className="mt-10 flex justify-center"
          >
            <Button size="lg" variant="outline" className="gap-2 font-bold uppercase tracking-wider hover:bg-accent hover:text-accent-foreground hover:border-accent" asChild>
              <Link href="/news">
                {dict.viewAll}
                <ArrowRight weight="bold" />
              </Link>
            </Button>
          </motion.div>
        )}
      </div>
    </section>
  )
}
