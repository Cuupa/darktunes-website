'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { X } from '@phosphor-icons/react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { Video } from '@/types'
import { ConsentGate } from '@/components/ConsentGate'
import type { DialogProps } from '@/lib/component-contracts'

interface VideoModalProps extends DialogProps {
  video: Video | null
  /** Optional R2 placeholder image URL shown before consent is given. */
  placeholderUrl?: string
  /** Translated label for the YouTube consent gate button. */
  youtubeLabel?: string
}

export function VideoModal({ video, open, onClose, placeholderUrl, youtubeLabel }: VideoModalProps) {
  const prefersReducedMotion = useReducedMotion()

  if (!video) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent aria-labelledby="video-modal-title" aria-describedby={undefined} className="max-w-full w-screen p-0 bg-background/95 backdrop-blur-xl border-accent/30 overflow-hidden max-h-[92vh] flex flex-col rounded-none sm:rounded-lg sm:max-w-[95vw] sm:w-[95vw]">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative"
            >
              <button
                onClick={onClose}
                aria-label="Close video"
                className="absolute -top-12 right-0 z-50 rounded-full bg-background/80 backdrop-blur-sm p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110 border border-border"
              >
                <X size={20} weight="bold" aria-hidden="true" />
              </button>
              
              <div className="relative w-full" style={{ paddingBottom: '56.25%', minHeight: 180 }}>
                <div className="absolute inset-0">
                  <ConsentGate label={youtubeLabel ?? 'YouTube laden'} placeholderUrl={placeholderUrl}>
                    <iframe
                      className="w-full h-full rounded-t-lg"
                      src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </ConsentGate>
                </div>
              </div>

              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
                className="p-6 bg-card/50 backdrop-blur-sm border-t border-border"
              >
                <h3 id="video-modal-title" className="text-2xl font-bold mb-2">{video.title}</h3>
                <p className="text-muted-foreground font-mono">{video.artistName}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
