'use client'

/**
 * app/portal/documents/_components/DocumentVault.tsx
 *
 * Client-side document vault: upload, categorize, download, delete legal documents.
 */

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UploadSimple, DownloadSimple, Trash, Folder, Spinner } from '@phosphor-icons/react'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import type { ArtistDocument } from '@/lib/api/artistDocuments'
import type { Dictionary } from '@/i18n/types'

const CATEGORIES = ['contract', 'split_agreement', 'gema', 'other'] as const
type Category = typeof CATEGORIES[number]

interface DocumentVaultProps {
  dict: Dictionary['portal']
  documents: ArtistDocument[]
  artistId: string
}

function categoryLabel(cat: string, dict: Dictionary['portal']): string {
  switch (cat) {
    case 'contract': return dict.documents_category_contract
    case 'split_agreement': return dict.documents_category_split_agreement
    case 'gema': return dict.documents_category_gema
    default: return dict.documents_category_other
  }
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentVault({ dict, documents: initialDocuments, artistId }: DocumentVaultProps) {
  const [documents, setDocuments] = useState<ArtistDocument[]>(initialDocuments)
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Upload form state
  const [uploadLabel, setUploadLabel] = useState('')
  const [uploadCategory, setUploadCategory] = useState<Category>('contract')
  const [uploadNotes, setUploadNotes] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = activeCategory === 'all'
    ? documents
    : documents.filter((d) => d.category === activeCategory)

  const getSession = async () => {
    const supabase = createBrowserSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadLabel.trim()) {
      toast.error('Please provide a label before uploading')
      return
    }
    setUploading(true)
    try {
      const session = await getSession()
      if (!session) { toast.error(dict.profile_error); return }

      const form = new FormData()
      form.append('file', file)
      form.append('label', uploadLabel.trim())
      form.append('category', uploadCategory)
      if (uploadNotes.trim()) form.append('notes', uploadNotes.trim())

      const res = await fetch('/api/portal/documents/upload', {
        method: 'POST',
        headers: {
          Authorization: ['Bearer', session.access_token].join(' '),
        },
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error((err as { error?: string }).error ?? 'Upload failed')
      }
      const json = await res.json() as { document: ArtistDocument }
      setDocuments((prev) => [json.document, ...prev])
      setUploadLabel('')
      setUploadNotes('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success(dict.documents_upload)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.profile_error)
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (docId: string) => {
    setDownloadingId(docId)
    try {
      const session = await getSession()
      if (!session) { toast.error(dict.profile_error); return }

      const res = await fetch(`/api/portal/documents/${docId}/download`, {
        headers: { Authorization: ['Bearer', session.access_token].join(' ') },
      })
      if (!res.ok) throw new Error('Failed to get download URL')
      const { url } = await res.json() as { url: string }
      window.open(url, '_blank', 'noopener')
    } catch {
      toast.error(dict.profile_error)
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (docId: string) => {
    if (!confirm(dict.documents_delete_confirm)) return
    setDeletingId(docId)
    try {
      const session = await getSession()
      if (!session) { toast.error(dict.profile_error); return }

      const res = await fetch(`/api/portal/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: ['Bearer', session.access_token].join(' ') },
      })
      if (!res.ok) throw new Error('Delete failed')
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
      toast.success(dict.documents_heading)
    } catch {
      toast.error(dict.profile_error)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{dict.documents_heading}</h1>

      {/* Upload section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.documents_upload}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="doc-label">Label</Label>
              <Input
                id="doc-label"
                value={uploadLabel}
                onChange={(e) => setUploadLabel(e.target.value)}
                placeholder="e.g. Band Agreement 2025"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="doc-category">Category</Label>
              <select
                id="doc-category"
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as Category)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{categoryLabel(cat, dict)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="doc-notes">Notes (optional)</Label>
              <Input
                id="doc-notes"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Short note…"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || !uploadLabel.trim()}
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              {uploading
                ? <Spinner size={14} className="animate-spin" aria-hidden="true" />
                : <UploadSimple size={14} aria-hidden="true" />}
              {dict.documents_upload}
            </Button>
            <span className="text-xs text-muted-foreground">PDF / DOCX · max 20 MB</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            className="hidden"
            onChange={handleUpload}
            aria-label="Upload document"
          />
        </CardContent>
      </Card>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', ...CATEGORIES] as const).map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(cat)}
          >
            {cat === 'all' ? 'All' : categoryLabel(cat, dict)}
          </Button>
        ))}
      </div>

      {/* Document list */}
      {filtered.length === 0 ? (
        <PortalEmptyState
          icon={Folder}
          heading={dict.documents_heading}
          description={dict.documents_upload}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      {doc.label}
                      {doc.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">{doc.notes}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{categoryLabel(doc.category, dict)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatBytes(doc.fileSizeBytes)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={downloadingId === doc.id}
                          onClick={() => handleDownload(doc.id)}
                          aria-label={dict.documents_download}
                        >
                          {downloadingId === doc.id
                            ? <Spinner size={14} className="animate-spin" aria-hidden="true" />
                            : <DownloadSimple size={14} aria-hidden="true" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === doc.id}
                          onClick={() => handleDelete(doc.id)}
                          aria-label="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          {deletingId === doc.id
                            ? <Spinner size={14} className="animate-spin" aria-hidden="true" />
                            : <Trash size={14} aria-hidden="true" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
