'use client'

import { CaretRight, House } from '@phosphor-icons/react'
import type { AssetFolder } from '@/types'

interface ExplorerBreadcrumbProps {
  path: AssetFolder[]
  onNavigate: (folderId: string | null) => void
}

export function ExplorerBreadcrumb({ path, onNavigate }: ExplorerBreadcrumbProps) {
  return (
    <nav aria-label="Asset path" className="shrink-0 flex flex-wrap items-center gap-1 border-b border-border px-4 py-2 text-sm">
      <button type="button" className="inline-flex items-center gap-2 rounded px-2 py-1 hover:bg-muted" onClick={() => onNavigate(null)}>
        <House size={14} aria-hidden="true" />
        Root
      </button>
      {path.map((folder) => (
        <div key={folder.id} className="flex items-center gap-1">
          <CaretRight size={12} className="text-muted-foreground" aria-hidden="true" />
          <button type="button" className="rounded px-2 py-1 hover:bg-muted" onClick={() => onNavigate(folder.id)}>
            {folder.name}
          </button>
        </div>
      ))}
    </nav>
  )
}
