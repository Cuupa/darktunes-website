'use client'

/**
 * VideoInsertDialog — dialog for inserting a YouTube video into the editor.
 *
 * Admin pastes a YouTube URL; we extract the video ID and insert an embed.
 */

import { useCallback, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { extractYouTubeId } from './YouTubeEmbedExtension'

interface Props {
  editor: Editor
  open: boolean
  onClose: () => void
}

export function VideoInsertDialog({ editor, open, onClose }: Props) {
  const [url, setUrl] = useState('')

  const videoId = extractYouTubeId(url)

  const handleClose = useCallback(() => {
    setUrl('')
    onClose()
  }, [onClose])

  const handleInsert = useCallback(() => {
    if (!videoId) return
    editor.chain().focus().setYouTubeEmbed(videoId).run()
    handleClose()
  }, [editor, videoId, handleClose])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md" aria-labelledby="video-dialog-title">
        <DialogHeader>
          <DialogTitle id="video-dialog-title">Video einfügen</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="video-url">YouTube-Link</Label>
          <Input
            id="video-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            onKeyDown={(e) => { if (e.key === 'Enter' && videoId) handleInsert() }}
            autoFocus
          />
          {url && !videoId && (
            <p className="text-xs text-destructive">Kein gültiger YouTube-Link</p>
          )}
          {videoId && (
            <p className="text-xs text-muted-foreground">Video-ID: {videoId}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button type="button" onClick={handleInsert} disabled={!videoId}>
            Einfügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
