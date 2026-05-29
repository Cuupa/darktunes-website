'use client'

import type { MouseEvent as ReactMouseEvent } from 'react'
import { useRef, useState } from 'react'
import { Pause, Play } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface InlineAudioPlayerProps {
  src: string
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

export function InlineAudioPlayer({ src }: InlineAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      await audio.play()
      setIsPlaying(true)
      return
    }
    audio.pause()
    setIsPlaying(false)
  }

  const handleSeek = (event: ReactMouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || duration === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    audio.currentTime = Math.max(0, Math.min(duration, duration * ratio))
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex items-center gap-2 min-w-0">
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11 shrink-0"
        onClick={() => void togglePlayback()}
        aria-label={isPlaying ? 'Pause audio preview' : 'Play audio preview'}
      >
        {isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      </Button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={handleSeek}>
        <Progress value={progress} aria-label="Audio progress" />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(duration)}</span>
    </div>
  )
}
