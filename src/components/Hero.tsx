import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, ArrowRight } from '@phosphor-icons/react'
import type { Release } from '@/types'

interface HeroProps {
  featuredRelease: Release
}

export function Hero({ featuredRelease }: HeroProps) {
  return (
    <section id="hero" className="relative min-h-screen flex items-center pt-20">
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(16, 16, 16, 0.4), rgba(16, 16, 16, 0.95)), url(${featuredRelease.coverArt})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      <div className="container mx-auto px-4 lg:px-8 z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-8"
          >
            <Badge className="bg-accent text-accent-foreground uppercase tracking-wider font-bold">
              New Release
            </Badge>
            
            <div className="space-y-4">
              <h2 className="text-6xl lg:text-8xl font-bold leading-none tracking-tight">
                {featuredRelease.title}
              </h2>
              <p className="text-3xl lg:text-4xl text-muted-foreground font-medium">
                {featuredRelease.artistName}
              </p>
            </div>

            <p className="text-lg text-muted-foreground max-w-lg">
              Experience the latest evolution in alternative music. 
              Out now on all streaming platforms.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold uppercase tracking-wider group">
                <Play className="mr-2 group-hover:scale-110 transition-transform" weight="fill" />
                Listen Now
              </Button>
              <Button size="lg" variant="outline" className="border-2 font-bold uppercase tracking-wider group">
                View Release
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <div className="glow-card relative aspect-square rounded-2xl overflow-hidden shadow-2xl">
              <img 
                src={featuredRelease.coverArt} 
                alt={`${featuredRelease.title} cover`}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <p className="text-sm uppercase tracking-wider mb-2">Scroll to explore</p>
      </motion.div>
    </section>
  )
}
