'use client'
/**
 * Reusable image upload button for admin forms.
 * Uploads the selected file to /api/upload (requires admin/editor auth)
 * and calls onUploaded with the resulting public URL.
 */

import { useRef, useState } from 'react'
import { useMemo } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { UploadSimple } from '@phosphor-icons/react'

interface ImageUploadButtonProps {
  /** Called with the R2 public URL once the upload succeeds. */
  onUploaded: (url: string) => void
  /** Additional CSS class names for the button wrapper. */
  className?: string
  /** Accessible label for the button. Defaults to "Upload image". */
  label?: string
}

export function ImageUploadButton({ onUploaded, className, label = 'Upload image' }: ImageUploadButtonProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const { publicUrl } = (await res.json()) as { publicUrl: string }
      onUploaded(publicUrl)
    } catch (err) {
      // Surface upload errors to the console; in practice the admin will
      // notice the field didn't update and retry.
      console.error('[ImageUploadButton] Upload failed:', err)
    } finally {
      setIsUploading(false)
      // Reset file input so the same file can be re-selected if needed
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
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
        className={`gap-1.5 ${className ?? ''}`}
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        title={label}
      >
        <UploadSimple size={14} aria-hidden="true" />
        {isUploading ? 'Uploading…' : label}
      </Button>
    </>
  )
}
