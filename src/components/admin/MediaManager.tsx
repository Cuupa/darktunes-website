'use client'

/**
 * src/components/admin/MediaManager.tsx
 *
 * Admin interface for the "Media" tab — combines:
 *   1. Press Kit & Applications  — journalist applications, EPK press photos,
 *      and private promo tracks (legacy form-based upload).
 *   2. Media Files               — full FileExplorer with access to all assets,
 *      drag-and-drop upload, folder organisation, context-menu actions, etc.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Broadcast, FolderOpen } from '@phosphor-icons/react'
import { JournalistManager } from './JournalistManager'
import { FileExplorer } from './file-explorer/FileExplorer'

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

      {/* ── Media Files — full file explorer ─────────────────────────── */}
      <TabsContent value="files">
        <p className="mb-3 text-sm text-muted-foreground">
          Upload and organise all media assets. Drag and drop files, create folders,
          assign artists or releases, and manage tags. All assets are shared with the
          Assets tab.
        </p>
        <FileExplorer />
      </TabsContent>

      {/* ── Press Kit & Applications ──────────────────────────────────── */}
      <TabsContent value="presskit">
        <JournalistManager />
      </TabsContent>
    </Tabs>
  )
}
