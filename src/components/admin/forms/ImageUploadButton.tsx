'use client'
/**
 * Reusable image upload button for admin forms.
 * Uploads the selected file to /api/upload (requires admin/editor auth)
 * and calls onUploaded with the resulting public URL.
 * Shows a real upload-progress bar via XHR.
 */

import { useRef, useState } from 'react'
import { useMemo } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { UploadSimple, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface ImageUploadButtonProps {
  /** Called with the R2 public URL once the upload succeeds. */
  onUploaded: (url: string) => void
  /** Additional CSS class names for the button wrapper. */
  className?: string
  /** Accessible label for the button. Defaults to "Upload image". */
  label?: string
  /** Upload endpoint. Defaults to /api/upload (admin). */
  endpoint?: string
  /** When provided, the uploaded asset is automatically assigned to this artist and placed in their folder. */
  artistId?: string
}

export function ImageUploadButton({
  onUploaded,
  className,
  label = 'Upload image',
  endpoint = '/api/upload',
  artistId,
}: ImageUploadButtonProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const isUploading = uploadProgress !== null && uploadProgress < 100

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadProgress(0)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', file)
      if (artistId) formData.append('artistId', artistId)
      const token = session.access_token

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText) as { publicUrl?: string; error?: string }
              if (data.publicUrl) {
                setUploadProgress(100)
                onUploaded(data.publicUrl)
                resolve()
              } else {
                reject(new Error(data.error ?? `HTTP ${xhr.status}`))
              }
            } catch {
              reject(new Error('Invalid server response'))
            }
          } else {
            try {
              const data = JSON.parse(xhr.responseText) as { error?: string }
              reject(new Error(data.error ?? `HTTP ${xhr.status}`))
            } catch {
              reject(new Error(`HTTP ${xhr.status}`))
            }
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Network error')))
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

        xhr.open('POST', endpoint)
        xhr.setRequestHeader('Authorization', 'Bearer ' + token)
        xhr.send(formData)
      })

      toast.success('Image uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      // Keep progress bar visible briefly at 100% then hide
      setTimeout(() => setUploadProgress(null), 800)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 shrink-0"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        title={label}
      >
        {uploadProgress === 100 ? (
          <CheckCircle size={14} className="text-green-500" aria-hidden="true" />
        ) : (
          <UploadSimple size={14} className={isUploading ? 'animate-bounce' : ''} aria-hidden="true" />
        )}
        {isUploading ? `${uploadProgress}%` : label}
      </Button>
      {uploadProgress !== null && (
        <Progress
          value={uploadProgress}
          className="h-1 w-full"
          aria-label="Upload progress"
        />
      )}
    </div>
  )
}
