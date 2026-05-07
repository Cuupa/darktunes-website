import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Calendar } from '@phosphor-icons/react'
import type { NewsPost } from '@/types'

interface NewsProps {
  news: NewsPost[]
}

export function News({ news }: NewsProps) {
  return (
    <section id="news" className="py-24 px-4 lg:px-16">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-5xl lg:text-6xl font-bold mb-4 tracking-tight">NEWS</h2>
          <p className="text-xl text-muted-foreground font-serif">Stay updated with the latest happenings</p>
        </motion.div>

        <div className="space-y-8">
          {news.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Card className="glow-card group bg-card border-border overflow-hidden hover:border-accent/50 transition-all duration-300">
                <div className="grid lg:grid-cols-[320px_1fr] gap-0">
                  {post.imageUrl && (
                    <div className="relative aspect-[16/9] lg:aspect-auto overflow-hidden">
                      <img 
                        src={post.imageUrl} 
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/20" />
                    </div>
                  )}
                  <div className="p-6 lg:p-8 flex flex-col justify-center">
                    <Badge className="self-start mb-4 bg-primary/20 text-primary-foreground border-primary/30 uppercase font-mono text-xs tracking-widest flex items-center gap-2">
                      <Calendar size={12} weight="bold" />
                      {new Date(post.publishedAt).toLocaleDateString('en-US', {
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
                    >
                      Read Full Story
                      <ArrowRight className="ml-2 group-hover/btn:translate-x-2 transition-transform" weight="bold" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
