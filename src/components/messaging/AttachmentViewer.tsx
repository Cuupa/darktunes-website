'use client'

/**
 * src/components/messaging/AttachmentViewer.tsx
 *
 * Displays a list of file attachments for a message.
 * Shows file name, size, mime-type icon, and a download link.
 */

import { FilePdf, FileZip, FileImage, FileAudio, FileVideo, FileDoc, FileArrowDown, File } from '@phosphor-icons/react'
import type { MessageAttachment } from '@/types'

interface AttachmentViewerProps {
  attachments: MessageAttachment[]
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/'))       return FileImage
  if (mimeType.startsWith('audio/'))       return FileAudio
  if (mimeType.startsWith('video/'))       return FileVideo
  if (mimeType === 'application/pdf')      return FilePdf
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return FileZip
  if (mimeType.includes('word') || mimeType.includes('document'))  return FileDoc
  return File
}

function formatSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentViewer({ attachments }: AttachmentViewerProps) {
  if (attachments.length === 0) return null

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Attachments ({attachments.length})
      </p>
      <div className="space-y-1.5">
        {attachments.map((att) => {
          const Icon = getFileIcon(att.mimeType)
          return (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              download={att.filename}
              className="flex items-center gap-3 rounded-md border border-border bg-card/60 px-3 py-2 text-sm transition-colors hover:bg-card hover:border-primary/50 group"
            >
              <Icon size={18} className="shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
              <span className="flex-1 truncate font-medium">{att.filename}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatSize(att.size)}</span>
              <FileArrowDown size={16} className="shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </a>
          )
        })}
      </div>
    </div>
  )
}
