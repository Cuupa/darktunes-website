'use client'

/**
 * src/components/admin/MediaManager.tsx
 *
 * Admin interface for the "Media" tab — combines:
 *   1. Press Kit & Applications  — journalist applications, EPK press photos,
 *      and private promo tracks (legacy form-based upload).
 *   2. Media Files               — dedicated file browser backed by the
 *      media_files / media_folders tables, fully independent from the Assets tab.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Broadcast, FolderOpen } from '@phosphor-icons/react'
import { JournalistManager } from './JournalistManager'
import { MediaFileExplorer } from './media-explorer/MediaFileExplorer'

export function MediaManager() {
  return (
    <Tabs defaultValue="files" className="space-y-4">
      <TabsList className="flex h-auto flex-wrap gap-1 p-1">
        <TabsTrigger value="files" className="gap-2">
          <FolderOpen size={16} weight="bold" aria-hidden="true" />
          Media Files
        </TabsTrigger>
        <TabsTrigger value="presskit" className="gap-2">
          <Broadcast size={16} weight="bold" aria-hidden="true" />
          Press Kit &amp; Applications
        </TabsTrigger>
      </TabsList>

      {/* ── Media Files — dedicated media filesystem ──────────────────── */}
      <TabsContent value="files">
        <p className="mb-3 text-sm text-muted-foreground">
          Upload and organise media assets. Drag and drop files, create folders, and manage tags.
          Media files are stored in a dedicated filesystem, separate from the Assets tab.
        </p>
        <MediaFileExplorer />
      </TabsContent>

      {/* ── Press Kit & Applications ──────────────────────────────────── */}
      <TabsContent value="presskit">
        <JournalistManager />
      </TabsContent>
    </Tabs>
  )
}
