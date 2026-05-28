'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Trash, Copy, UploadSimple } from '@phosphor-icons/react'
import { useAssets } from '@/hooks/useAssets'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Asset, ArtistAsset } from '@/types'

interface ArtistAssetRow extends ArtistAsset {
  artistName?: string
}

interface UploadResult {
  publicUrl: string
  r2Key: string
  filename: string
  mimeType: string
  sizeBytes: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function AssetsManager() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { assets, isLoading, createAssetRecord, reload } = useAssets()
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Artist assets — loaded separately; admins see all via the admin_all RLS policy
  const [artistAssets, setArtistAssets] = useState<ArtistAssetRow[]>([])
  const [artistAssetsLoading, setArtistAssetsLoading] = useState(true)

  const loadArtistAssets = useCallback(async () => {
    setArtistAssetsLoading(true)
    try {
      const { data } = await supabase
        .from('artist_assets')
        .select('*, artists(name)')
        .order('created_at', { ascending: false })
      if (data) {
        setArtistAssets(
          data.map((row) => ({
            id: row.id,
            artistId: row.artist_id,
            artistName: (row.artists as { name?: string } | null)?.name ?? undefined,
            filename: row.filename,
            originalFilename: row.original_filename,
            mimeType: row.mime_type,
            sizeBytes: row.size_bytes,
            r2Key: row.r2_key,
            publicUrl: row.public_url,
            label: row.label ?? undefined,
            createdAt: row.created_at,
          })),
        )
      }
    } catch {
      // non-fatal — just show empty state
    } finally {
      setArtistAssetsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadArtistAssets()
  }, [loadArtistAssets])

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const file = fileInputRef.current?.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Upload failed: ${text}`)
      }

      const json: unknown = await response.json()
      if (
        typeof json !== 'object' ||
        json === null ||
        !('publicUrl' in json) ||
        !('r2Key' in json) ||
        !('filename' in json) ||
        !('mimeType' in json) ||
        !('sizeBytes' in json)
      ) {
        throw new Error('Unexpected response format from upload API')
      }
      const result = json as UploadResult

      await createAssetRecord({
        filename: result.filename,
        original_filename: file.name,
        mime_type: result.mimeType,
        size_bytes: result.sizeBytes,
        r2_key: result.r2Key,
        public_url: result.publicUrl,
        uploaded_by: session.user.id,
      })

      toast.success(`Uploaded "${file.name}"`)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleCopyUrl = (url: string) => {
    void navigator.clipboard.writeText(url)
    toast.success('URL copied to clipboard')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsMutating(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const response = await fetch(`/api/admin/assets/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Delete failed: ${text}`)
      }

      toast.success(`Deleted "${deleteTarget.originalFilename}"`)
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleUpload} className="flex items-end gap-3 p-4 rounded-lg border border-border bg-card">
        <div className="flex-1 space-y-1">
          <Label htmlFor="file-upload">Upload File to R2</Label>
          <Input id="file-upload" type="file" ref={fileInputRef} disabled={isUploading} />
        </div>
        <Button type="submit" disabled={isUploading} className="gap-2 shrink-0">
          <UploadSimple size={16} weight="bold" />
          {isUploading ? 'Uploading…' : 'Upload'}
        </Button>
      </form>

      <div>
        <p className="text-sm text-muted-foreground mb-2">{assets.length} asset(s)</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Preview</TableHead>
              <TableHead>Filename</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No assets yet. Upload a file above.
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    {isImageMimeType(asset.mimeType) ? (
                      <img
                        src={asset.publicUrl}
                        alt={asset.originalFilename}
                        className="w-10 h-10 object-cover rounded border border-border"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center rounded border border-border bg-muted text-muted-foreground">
                        <span className="text-xs font-mono uppercase truncate px-1">
                          {asset.mimeType.split('/')[1]?.slice(0, 3) ?? '?'}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{asset.originalFilename}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{asset.mimeType}</TableCell>
                  <TableCell>{formatBytes(asset.sizeBytes)}</TableCell>
                  <TableCell>{asset.createdAt.split('T')[0]}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleCopyUrl(asset.publicUrl)}
                        title="Copy URL"
                        aria-label={`Copy URL for ${asset.originalFilename}`}
                      >
                        <Copy size={16} aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteTarget(asset)}
                        title="Delete"
                        aria-label={`Delete ${asset.originalFilename}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{' '}
              <strong>{deleteTarget?.originalFilename}</strong>? This removes the file from both the
              database and Cloudflare R2 storage and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isMutating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Artist-uploaded assets — all uploads from the artist portal, visible to admins */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Artist Assets</h3>
        <p className="text-sm text-muted-foreground mb-2">{artistAssets.length} artist asset(s)</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Preview</TableHead>
              <TableHead>Filename</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {artistAssetsLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            ) : artistAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No artist assets yet.
                </TableCell>
              </TableRow>
            ) : (
              artistAssets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    {isImageMimeType(asset.mimeType) ? (
                      <img
                        src={asset.publicUrl}
                        alt={asset.originalFilename}
                        className="w-10 h-10 object-cover rounded border border-border"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center rounded border border-border bg-muted text-muted-foreground">
                        <span className="text-xs font-mono uppercase truncate px-1">
                          {asset.mimeType.split('/')[1]?.slice(0, 3) ?? '?'}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{asset.originalFilename}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{asset.artistName ?? asset.artistId}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{asset.mimeType}</TableCell>
                  <TableCell>{formatBytes(asset.sizeBytes)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{asset.label ?? '—'}</TableCell>
                  <TableCell>{asset.createdAt.split('T')[0]}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopyUrl(asset.publicUrl)}
                      title="Copy URL"
                      aria-label={`Copy URL for ${asset.originalFilename}`}
                    >
                      <Copy size={16} aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
