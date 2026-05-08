'use client'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Trash, Copy, UploadSimple } from '@phosphor-icons/react'
import { useAssets } from '@/hooks/useAssets'
import { supabase } from '@/lib/supabase'
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
import type { Asset } from '@/types'

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

export function AssetsManager() {
  const { assets, isLoading, createAssetRecord, deleteAssetRecord } = useAssets()
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      await deleteAssetRecord(deleteTarget.id)
      toast.success(`Deleted "${deleteTarget.originalFilename}"`)
      setDeleteTarget(null)
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
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No assets yet. Upload a file above.
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow key={asset.id}>
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
                      >
                        <Copy size={16} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteTarget(asset)}
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash size={16} />
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
              Are you sure you want to delete{' '}
              <strong>{deleteTarget?.originalFilename}</strong>? The file record will be removed from
              the database. The object in R2 may need to be deleted separately.
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
    </div>
  )
}
