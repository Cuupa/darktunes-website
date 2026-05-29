'use client'

import { FileExplorer } from './file-explorer/FileExplorer'

export function AssetsManager() {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Manage all media assets. Upload files, organize in folders, assign to artists.
      </p>
      <FileExplorer />
    </div>
  )
}
