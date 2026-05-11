'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, ArrowDown } from '@phosphor-icons/react'
import type { Release, SiteSettings } from '@/types'
import type { Dictionary } from '@/i18n/types'

interface HeroProps {
  featuredRelease?: Release
  siteSettings: SiteSettings
  dict: Dictionary['hero']
}

export function Hero({ featuredRelease, siteSettings, dict }: HeroProps) {
  if (!featuredRelease) {
    return null
  }

  const handleSmoothScroll = (targetId: string) => {
    const target = document.querySelector(targetId)
    if (target) {
      const headerOffset = 140
      const elementPosition = target.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.scrollY - headerOffset
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' })
    }
  }

  const handleListenNow = () => {
    if (featuredRelease.spotifyUrl) {
      window.open(featuredRelease.spotifyUrl, '_blank', 'noopener,noreferrer')
    } else {
      handleSmoothScroll('#spotify-player')
    }
  }

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center pt-32 pb-16">
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(18, 18, 18, 0.3), rgba(18, 18, 18, 0.95)), url(${featuredRelease.coverArt})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      />
      
      <div className="container mx-auto px-4 lg:px-16 z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-8"
          >
            <Badge className="bg-secondary/90 text-secondary-foreground uppercase tracking-wider font-bold text-sm px-4 py-2 backdrop-blur-sm">
              {siteSettings.heroBadge}
            </Badge>
            
            <div className="space-y-4">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold leading-none tracking-tight">
                {featuredRelease.title}
              </h1>
              <p className="text-3xl md:text-4xl lg:text-5xl text-muted-foreground font-medium font-serif">
                {featuredRelease.artistName}
              </p>
            </div>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl font-serif leading-relaxed">
              {siteSettings.heroDescription}
            </p>

            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold uppercase tracking-wider group text-base px-8 py-6" onClick={handleListenNow}>
                <Play className="mr-2 group-hover:scale-110 transition-transform" weight="fill" size={24} />
                {dict.listenNow}
              </Button>
              <Button size="lg" variant="outline" className="border-2 font-bold uppercase tracking-wider group text-base px-8 py-6 hover:bg-primary hover:text-primary-foreground hover:border-primary" onClick={() => handleSmoothScroll('#artists')}>
                {dict.exploreArtist}
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <div className="glow-card relative aspect-square rounded-lg overflow-hidden shadow-2xl shadow-accent/20">
              <img 
                src={featuredRelease.coverArt} 
                alt={`${featuredRelease.title} cover`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-muted-foreground"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <p className="text-sm uppercase tracking-widest font-mono">{dict.scrollDown}</p>
        <ArrowDown size={20} weight="bold" />
      </motion.div>
    </section>
  )
}
