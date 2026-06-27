'use client'

/**
 * src/components/epk-builder/EpkFontManager.tsx
 *
 * Upload and manage custom fonts for the EPK canvas editor.
 */

import { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { UploadSimple, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useEpkEditorStore } from '@/lib/epk/editor/EpkEditorProvider'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { EpkGoogleFontPicker } from './EpkGoogleFontPicker'

export interface EpkFontAsset {
  id: string
  name: string
  family: string
  r2Key: string
  mimeType: string
  publicUrl: string
  createdAt: string
}

interface EpkFontManagerProps {
  artistId: string
  initialFonts: EpkFontAsset[]
}

export function EpkFontManager({ artistId, initialFonts }: EpkFontManagerProps) {
  const t = useTranslations('portal')
  const documentFonts = useEpkEditorStore((s) => s.document.fonts)
  const addDocumentFont = useEpkEditorStore((s) => s.addDocumentFont)
  const removeDocumentFont = useEpkEditorStore((s) => s.removeDocumentFont)
  const [fonts, setFonts] = useState(initialFonts)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(t('epk_builder_export_auth_error'))
        return
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/portal/epk/fonts?artistId=${artistId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      if (!response.ok) throw new Error(t('epk_fonts_upload_error'))

      const payload = (await response.json()) as { font: EpkFontAsset }
      setFonts((prev) => [payload.font, ...prev])
      addDocumentFont({
        id: payload.font.id,
        family: payload.font.family,
        src: payload.font.publicUrl,
        r2Key: payload.font.r2Key,
      })
      toast.success(t('epk_fonts_upload_success'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('epk_fonts_upload_error'))
    } finally {
      setUploading(false)
    }
  }, [addDocumentFont, artistId, t])

  const handleDelete = useCallback(async (fontId: string) => {
    setDeletingId(fontId)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(t('epk_builder_export_auth_error'))
        return
      }

      const response = await fetch(`/api/portal/epk/fonts?artistId=${artistId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: fontId }),
      })

      if (!response.ok) throw new Error(t('epk_fonts_delete_error'))

      setFonts((prev) => prev.filter((f) => f.id !== fontId))
      removeDocumentFont(fontId)
      toast.success(t('epk_fonts_delete_success'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('epk_fonts_delete_error'))
    } finally {
      setDeletingId(null)
    }
  }, [artistId, t, removeDocumentFont])

  return (
    <div className="rounded-lg border border-border bg-card" data-lenis-prevent>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t('epk_fonts_title')}</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleUpload(file)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadSimple size={16} className="mr-2" aria-hidden="true" />
          {uploading ? t('epk_fonts_uploading') : t('epk_fonts_upload')}
        </Button>
      </div>

      <div className="space-y-4 p-4 max-h-[min(280px,40vh)] overflow-y-auto">
        <EpkGoogleFontPicker />
        {fonts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('epk_fonts_empty')}</p>
        ) : (
          <ul className="space-y-2 list-none">
            {fonts.map((font) => {
              const inDocument = documentFonts.some((f) => f.id === font.id)
              return (
                <li
                  key={font.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{font.name}</p>
                    {inDocument && (
                      <p className="text-xs text-muted-foreground">{t('epk_fonts_in_document')}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] min-w-[44px] shrink-0"
                    disabled={deletingId === font.id}
                    aria-label={t('epk_fonts_delete')}
                    onClick={() => void handleDelete(font.id)}
                  >
                    <Trash size={16} aria-hidden="true" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}