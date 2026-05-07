import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { X } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
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
      <DialogContent className="max-w-6xl w-[95vw] p-0 bg-black border-accent/30">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative"
        >
          <DialogClose className="absolute -top-12 right-0 z-50 rounded-full bg-accent/20 p-2 text-foreground hover:bg-accent/40 transition-colors">
            <X size={24} weight="bold" />
          </DialogClose>
          
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full rounded-lg"
              src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="p-6 bg-card/50 backdrop-blur-sm">
            <h3 className="text-2xl font-bold mb-2">{video.title}</h3>
            <p className="text-muted-foreground">{video.artistName}</p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
