'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { useTranslations } from 'next-intl'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AssetPicker } from '@/components/admin/file-explorer/AssetPicker'
import { File as FileIcon, UploadSimple, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/clientErrors'
import type { ApiErrorResponse } from '@/lib/errors'

interface Props {
  editor: Editor
  open: boolean
  onClose: () => void
}

function UploadTab({ onUploaded }: { onUploaded: (url: string, fileName: string) => void }) {
  const tErrors = useTranslations('errors')
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const isUploading = progress !== null && progress < 100

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProgress(0)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error(tErrors('AUTH_REQUIRED'))

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const formData = new FormData()
        formData.append('file', file)

        xhr.upload.addEventListener('progress', (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100))
        })
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText) as { publicUrl?: string; error?: string; code?: string }
              if (data.publicUrl) {
                setProgress(100)
                onUploaded(data.publicUrl, file.name)
                resolve()
              } else {
                reject(new Error(getErrorMessage(data as ApiErrorResponse, tErrors)))
              }
            } catch {
              reject(new Error(tErrors('SERVER_ERROR')))
            }
          } else {
            try {
              reject(new Error(getErrorMessage(JSON.parse(xhr.responseText) as ApiErrorResponse, tErrors)))
            } catch {
              reject(new Error(tErrors('SERVER_ERROR')))
            }
          }
        })
        xhr.addEventListener('error', () => reject(new Error(tErrors('SERVER_ERROR'))))
        xhr.open('POST', '/api/upload')
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
        xhr.send(formData)
      })
      toast.success('File uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setTimeout(() => setProgress(null), 800)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border p-8 text-center">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        aria-hidden="true"
        onChange={handleFileChange}
      />
      <FileIcon size={32} className="text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Upload a document or file to link in the answer</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className="gap-1.5"
      >
        {progress === 100 ? (
          <CheckCircle size={14} className="text-green-500" aria-hidden="true" />
        ) : (
          <UploadSimple size={14} className={isUploading ? 'animate-bounce' : ''} aria-hidden="true" />
        )}
        {isUploading ? `${progress}%` : 'Choose file'}
      </Button>
      {progress !== null && <Progress value={progress} className="h-1 w-full max-w-xs" aria-label="Upload progress" />}
    </div>
  )
}

export function FileInsertDialog({ editor, open, onClose }: Props) {
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [labelInput, setLabelInput] = useState('')

  const insertFileLink = useCallback((href: string, label: string) => {
    const text = label.trim() || href.split('/').pop() || 'Download file'
    editor
      .chain()
      .focus()
      .insertContent(
        `<a class="tiptap-file-link" href="${href}" target="_blank" rel="noopener noreferrer" download>${text}</a>`,
      )
      .run()
    setUrlInput('')
    setLabelInput('')
    onClose()
  }, [editor, onClose])

  const handleClose = useCallback(() => {
    setUrlInput('')
    setLabelInput('')
    onClose()
  }, [onClose])

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Insert file link</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="upload">
            <TabsList className="w-full">
              <TabsTrigger value="upload" className="flex-1">Upload</TabsTrigger>
              <TabsTrigger value="library" className="flex-1">Asset library</TabsTrigger>
              <TabsTrigger value="url" className="flex-1">URL</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4">
              <UploadTab onUploaded={(url, name) => insertFileLink(url, name)} />
            </TabsContent>

            <TabsContent value="library" className="mt-4">
              <Button type="button" variant="outline" onClick={() => setAssetPickerOpen(true)}>
                Browse assets
              </Button>
            </TabsContent>

            <TabsContent value="url" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="file-url">File URL</Label>
                <Input
                  id="file-url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="file-label">Link label (optional)</Label>
                <Input
                  id="file-label"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="Download rider.pdf"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
            {urlInput.trim() && (
              <Button type="button" onClick={() => insertFileLink(urlInput.trim(), labelInput)}>
                Insert link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssetPicker
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onSelect={(asset) => {
          setAssetPickerOpen(false)
          insertFileLink(asset.publicUrl, asset.originalFilename || asset.filename || 'File')
        }}
      />
    </>
  )
}