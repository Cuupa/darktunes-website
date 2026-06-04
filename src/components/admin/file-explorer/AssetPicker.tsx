'use client'

import { useEffect, useMemo, useState } from 'react'
import NextImage from 'next/image'
import { CaretRight, FolderOpen, FolderSimple, House, Image as ImageIcon, MagnifyingGlass, MusicNotes } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Asset, AssetFolder } from '@/types'
import { formatBytes, isAudioAsset, isImageAsset } from './utils'

interface AssetPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (asset: Asset) => void
  mimeTypeFilter?: string
  artistId?: string
}

function matchesFilter(asset: Asset, mimeTypeFilter?: string): boolean {
  if (!mimeTypeFilter) return true
  return asset.mimeType.startsWith(mimeTypeFilter)
}

function AssetPickerCard({ asset, onSelect }: { asset: Asset; onSelect: (asset: Asset) => void }) {
  return (
    <button
      type="button"
      className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card/70 p-3 text-left transition hover:border-primary hover:bg-primary/5"
      onClick={() => onSelect(asset)}
    >
      {isImageAsset(asset) ? (
        <NextImage src={asset.publicUrl} alt={`${asset.originalFilename} – asset preview`} width={200} height={112} className="h-28 w-full rounded-md object-cover" unoptimized />
      ) : (
        <div className="flex h-28 items-center justify-center rounded-md border border-border bg-background/60">
          {isAudioAsset(asset) ? <MusicNotes size={24} className="text-secondary" aria-hidden="true" /> : <ImageIcon size={24} className="text-muted-foreground" aria-hidden="true" />}
        </div>
      )}
      <div className="space-y-1">
        <p className="truncate font-medium">{asset.originalFilename}</p>
        <p className="text-xs text-muted-foreground">{asset.mimeType}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(asset.sizeBytes)}</p>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Inline mini folder tree for the picker sidebar
// ---------------------------------------------------------------------------

interface PickerFolderNodeProps {
  folder: AssetFolder & { children?: AssetFolder[] }
  currentFolderId: string | null
  expanded: Set<string>
  onToggle: (id: string) => void
  onNavigate: (id: string | null) => void
}

function PickerFolderNode({ folder, currentFolderId, expanded, onToggle, onNavigate }: PickerFolderNodeProps) {
  const hasChildren = (folder.children?.length ?? 0) > 0
  const isExpanded = expanded.has(folder.id)
  const isActive = currentFolderId === folder.id

  return (
    <li className="space-y-0.5">
      <div className={cn('flex items-center gap-1 rounded-md px-1 py-0.5 text-xs', isActive && 'bg-primary/10 text-primary')}>
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center shrink-0"
          onClick={() => hasChildren && onToggle(folder.id)}
          aria-label={isExpanded ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
        >
          {hasChildren ? (isExpanded ? <CaretRight size={10} className="rotate-90" aria-hidden="true" /> : <CaretRight size={10} aria-hidden="true" />) : null}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-muted"
          onClick={() => onNavigate(folder.id)}
        >
          {isActive ? <FolderOpen size={13} className="shrink-0 text-primary" aria-hidden="true" /> : <FolderSimple size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {hasChildren && isExpanded && (
        <ul className="ml-4 space-y-0.5 border-l border-border pl-1.5">
          {folder.children?.map((child) => (
            <PickerFolderNode
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

function buildTree(folders: AssetFolder[], parentId: string | null = null): (AssetFolder & { children?: AssetFolder[] })[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .map((f) => ({ ...f, children: buildTree(folders, f.id) }))
}

export function AssetPicker({ open, onClose, onSelect, mimeTypeFilter, artistId }: AssetPickerProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [assets, setAssets] = useState<Asset[]>([])
  const [folders, setFolders] = useState<AssetFolder[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch all folders once when the picker opens
  useEffect(() => {
    if (!open) return
    let cancelled = false

    const loadFolders = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return
        const res = await fetch('/api/admin/assets/folders', {
          headers: { Authorization: 'Bearer ' + token },
        })
        if (!res.ok) return
        const json = (await res.json()) as { folders: AssetFolder[] }
        if (!cancelled) setFolders(json.folders)
      } catch {
        // non-critical — fall back to flat list
      }
    }
    void loadFolders()
    return () => { cancelled = true }
  }, [open, supabase])

  // Reset folder selection when picker closes
  useEffect(() => {
    if (!open) {
      setCurrentFolderId(null)
      setSearch('')
      setExpanded(new Set())
    }
  }, [open])

  // Fetch assets whenever search, folderId or artistId changes
  useEffect(() => {
    if (!open) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) throw new Error('Not authenticated')

        const params = new URLSearchParams()
        if (search.trim()) {
          params.set('search', search.trim())
        } else if (artistId) {
          params.set('artistId', artistId)
        } else if (currentFolderId) {
          params.set('folderId', currentFolderId)
        }
        // When currentFolderId is null and no search/artistId, no folderId param
        // is sent — the API then returns root-level assets (folder_id IS NULL)
        const response = await fetch(`/api/admin/assets?${params.toString()}`, {
          headers: { Authorization: 'Bearer ' + token },
        })
        if (!response.ok) throw new Error(await response.text())
        const json = (await response.json()) as { assets: Asset[] }
        if (!cancelled) setAssets(json.assets.filter((asset) => matchesFilter(asset, mimeTypeFilter)))
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Failed to load assets')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const timeout = window.setTimeout(() => { void load() }, 200)
    return () => { cancelled = true; window.clearTimeout(timeout) }
  }, [artistId, currentFolderId, mimeTypeFilter, open, search, supabase])

  const folderTree = useMemo(() => buildTree(folders), [folders])

  const handleToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleNavigate = (id: string | null) => {
    setSearch('')
    setCurrentFolderId(id)
  }

  // Build breadcrumb path for the current folder
  const folderPath = useMemo(() => {
    if (!currentFolderId) return []
    const path: AssetFolder[] = []
    let current: AssetFolder | undefined = folders.find((f) => f.id === currentFolderId)
    while (current) {
      path.unshift(current)
      current = current.parentId ? folders.find((f) => f.id === current?.parentId) : undefined
    }
    return path
  }, [currentFolderId, folders])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-5xl" aria-labelledby="asset-picker-title">
        <DialogHeader>
          <DialogTitle id="asset-picker-title">Select Asset</DialogTitle>
          <DialogDescription>
            Browse folders or search to choose a file from the asset library.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 overflow-hidden" style={{ height: '32rem' }}>
          {/* ── Folder sidebar ──────────────────────────────────────────── */}
          {folders.length > 0 && (
            <div className="w-44 shrink-0 overflow-y-auto rounded-md border border-border bg-card/40 p-2 text-xs">
              <p className="mb-1.5 px-1 font-semibold text-muted-foreground uppercase tracking-wide" style={{ fontSize: '0.65rem' }}>Folders</p>
              <ul className="space-y-0.5">
                <li>
                  <button
                    type="button"
                    className={cn('flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-muted', currentFolderId === null && !search && 'bg-primary/10 text-primary')}
                    onClick={() => handleNavigate(null)}
                  >
                    <House size={13} className="shrink-0" aria-hidden="true" />
                    <span>Root</span>
                  </button>
                </li>
                {folderTree.map((folder) => (
                  <PickerFolderNode
                    key={folder.id}
                    folder={folder}
                    currentFolderId={currentFolderId}
                    expanded={expanded}
                    onToggle={handleToggle}
                    onNavigate={handleNavigate}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* ── Main panel ─────────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/* Search bar */}
            <div className="relative">
              <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search all assets…" />
            </div>

            {/* Breadcrumb (shown only when browsing folders, not searching) */}
            {!search && currentFolderId !== null && (
              <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <button type="button" className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted" onClick={() => handleNavigate(null)}>
                  <House size={12} aria-hidden="true" />
                  Root
                </button>
                {folderPath.map((folder) => (
                  <div key={folder.id} className="flex items-center gap-1">
                    <CaretRight size={10} aria-hidden="true" />
                    <button type="button" className="rounded px-1.5 py-0.5 hover:bg-muted" onClick={() => handleNavigate(folder.id)}>
                      {folder.name}
                    </button>
                  </div>
                ))}
              </nav>
            )}

            {/* Asset grid */}
            <ScrollArea className="flex-1 rounded-md border border-border">
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {loading ? (
                  <p className="col-span-full text-sm text-muted-foreground">Loading assets…</p>
                ) : assets.length === 0 ? (
                  <p className="col-span-full text-sm text-muted-foreground">No matching assets found.</p>
                ) : (
                  assets.map((asset) => (
                    <AssetPickerCard
                      key={asset.id}
                      asset={asset}
                      onSelect={(selectedAsset) => {
                        onSelect(selectedAsset)
                        onClose()
                      }}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
