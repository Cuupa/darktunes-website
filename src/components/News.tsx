import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight } from '@phosphor-icons/react'
import type { NewsPost } from '@/types'

interface NewsProps {
  news: NewsPost[]
}

export function News({ news }: NewsProps) {
  return (
    <section id="news" className="py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-5xl lg:text-6xl font-bold mb-4">Latest News</h2>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Stay updated with the latest from the darkTunes universe.
          </p>
        </motion.div>

        <div className="space-y-6">
          {news.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Card className="group bg-card border-border overflow-hidden hover:border-accent transition-all duration-300">
                <div className="grid lg:grid-cols-[300px_1fr] gap-6">
                  {post.imageUrl && (
                    <div className="relative aspect-[16/9] lg:aspect-square overflow-hidden">
                      <img 
                        src={post.imageUrl} 
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-6 lg:py-8 flex flex-col justify-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      {new Date(post.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    <h3 className="text-2xl lg:text-3xl font-bold mb-4 group-hover:text-accent transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {post.excerpt}
                    </p>
                    <Button 
                      variant="ghost" 
                      className="self-start group/btn hover:text-accent"
                    >
                      Read More
                      <ArrowRight className="ml-2 group-hover/btn:translate-x-1 transition-transform" />
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
