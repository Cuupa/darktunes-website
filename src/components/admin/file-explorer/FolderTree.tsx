'use client'

import { useEffect, useMemo, useState } from 'react'
import { CaretDown, CaretRight, FolderOpen, FolderSimple, MusicNote, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { AssetFolder } from '@/types'
import { buildFolderTree } from './utils'

interface FolderTreeProps {
  folders: AssetFolder[]
  currentFolderId: string | null
  onNavigate: (folderId: string | null) => void
  onCreateRootFolder: () => void
}

interface FolderTreeNodeProps {
  folder: AssetFolder
  currentFolderId: string | null
  expanded: Set<string>
  onToggle: (folderId: string) => void
  onNavigate: (folderId: string) => void
}

function FolderTreeNode({ folder, currentFolderId, expanded, onToggle, onNavigate }: FolderTreeNodeProps) {
  const hasChildren = (folder.children?.length ?? 0) > 0
  const isExpanded = expanded.has(folder.id)
  const isActive = currentFolderId === folder.id

  return (
    <li className="space-y-1">
      <div className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-sm', isActive && 'bg-primary/10 text-primary')}>
        <button
          type="button"
          className="flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-muted"
          onClick={() => hasChildren && onToggle(folder.id)}
          aria-label={isExpanded ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
        >
          {hasChildren ? (isExpanded ? <CaretDown size={14} aria-hidden="true" /> : <CaretRight size={14} aria-hidden="true" />) : <span className="w-3" />}
        </button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted" onClick={() => onNavigate(folder.id)}>
          {folder.artistId ? <MusicNote size={16} className="text-secondary" aria-hidden="true" /> : null}
          {isActive ? <FolderOpen size={18} className="text-primary" aria-hidden="true" /> : <FolderSimple size={18} className="text-primary" aria-hidden="true" />}
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {hasChildren && isExpanded && (
        <ul className="ml-5 space-y-1 border-l border-border pl-2">
          {folder.children?.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              currentFolderId={currentFolderId}
              expanded={expanded}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function FolderTree({ folders, currentFolderId, onNavigate, onCreateRootFolder }: FolderTreeProps) {
  const tree = useMemo(() => buildFolderTree(folders), [folders])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!currentFolderId) return
    const next = new Set<string>()
    let current = folders.find((folder) => folder.id === currentFolderId) ?? null
    while (current?.parentId) {
      next.add(current.parentId)
      current = folders.find((folder) => folder.id === current?.parentId) ?? null
    }
    next.add(currentFolderId)
    setExpanded((previous) => new Set([...previous, ...next]))
  }, [currentFolderId, folders])

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <div>
          <h3 className="text-sm font-semibold">Folders</h3>
          <p className="text-xs text-muted-foreground">Organize assets by artist or campaign.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onCreateRootFolder} aria-label="Create root folder">
          <Plus size={18} aria-hidden="true" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        <div className="space-y-2">
          <button type="button" className={cn('flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted', currentFolderId === null && 'bg-primary/10 text-primary')} onClick={() => onNavigate(null)}>
            <FolderSimple size={18} className="text-primary" aria-hidden="true" />
            Root
          </button>
          <ul className="space-y-1">
            {tree.map((folder) => (
              <FolderTreeNode
                key={folder.id}
                folder={folder}
                currentFolderId={currentFolderId}
                expanded={expanded}
                onToggle={(folderId) => setExpanded((previous) => {
                  const next = new Set(previous)
                  if (next.has(folderId)) next.delete(folderId)
                  else next.add(folderId)
                  return next
                })}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      </ScrollArea>
    </div>
  )
}
