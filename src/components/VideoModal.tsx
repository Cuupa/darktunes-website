'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Video } from '@/types'

interface VideoModalProps {
  video: Video | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VideoModal({ video, open, onOpenChange }: VideoModalProps) {
  if (!video) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] p-0 bg-background/95 backdrop-blur-xl border-accent/30 overflow-hidden">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative"
            >
              <button
                onClick={() => onOpenChange(false)}
                className="absolute -top-12 right-0 z-50 rounded-full bg-background/80 backdrop-blur-sm p-2.5 text-foreground hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110 border border-border"
              >
                <X size={20} weight="bold" />
              </button>
              
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 w-full h-full rounded-t-lg"
                  src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-6 bg-card/50 backdrop-blur-sm border-t border-border"
              >
                <h3 className="text-2xl font-bold mb-2">{video.title}</h3>
                <p className="text-muted-foreground font-mono">{video.artistName}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
