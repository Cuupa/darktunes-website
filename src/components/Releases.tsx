import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Play } from '@phosphor-icons/react'
import type { Release } from '@/types'

interface ReleasesProps {
  releases: Release[]
}

export function Releases({ releases }: ReleasesProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <section id="releases" className="py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-5xl lg:text-6xl font-bold mb-4">Release Radar</h2>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Discover the latest music from our roster of boundary-pushing artists.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {releases.map((release) => (
            <motion.div key={release.id} variants={itemVariants}>
              <Card className="group bg-card border-border overflow-hidden hover:border-accent transition-all duration-300">
                <div className="relative aspect-square overflow-hidden">
                  <img 
                    src={release.coverArt} 
                    alt={`${release.title} cover`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-8">
                    <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                      <Play className="mr-2" weight="fill" />
                      Listen
                    </Button>
                  </div>
                  {release.featured && (
                    <Badge className="absolute top-4 right-4 bg-secondary text-secondary-foreground">
                      Featured
                    </Badge>
                  )}
                </div>
                <div className="p-6 space-y-2">
                  <Badge variant="outline" className="uppercase text-xs">
                    {release.type}
                  </Badge>
                  <h3 className="text-2xl font-bold line-clamp-1">{release.title}</h3>
                  <p className="text-muted-foreground">{release.artistName}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(release.releaseDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
