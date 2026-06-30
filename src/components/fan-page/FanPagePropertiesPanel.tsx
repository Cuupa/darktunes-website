'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Crop, Image as ImageIcon, UploadSimple } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TiptapEditor } from '@/components/admin/TiptapEditor'
import { EpkImageCropDialog } from '@/components/epk-builder/EpkImageCropDialog'
import { useFanPageEditorStore } from '@/lib/fan-page/editor/FanPageEditorProvider'
import type { FanPageImageProps } from '@/lib/fan-page/schema/documentV1'
import type { ImageCrop } from '@/lib/shared/imageCrop'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { validatePortalUpload, PORTAL_ASSET_RULES } from '@/lib/portal/uploadValidation'

interface FanPagePropertiesPanelProps {
  artistId: string
}

function readImage(props: Record<string, unknown>, key: string): FanPageImageProps | undefined {
  const value = props[key]
  if (!value || typeof value !== 'object') return undefined
  return value as FanPageImageProps
}

export function FanPagePropertiesPanel({ artistId }: FanPagePropertiesPanelProps) {
  const t = useTranslations('portal')
  const document = useFanPageEditorStore((s) => s.document)
  const selectedSectionId = useFanPageEditorStore((s) => s.selectedSectionId)
  const updateSectionProps = useFanPageEditorStore((s) => s.updateSectionProps)
  const updateSection = useFanPageEditorStore((s) => s.updateSection)
  const previewDevice = useFanPageEditorStore((s) => s.previewDevice)

  const [cropOpen, setCropOpen] = useState(false)
  const [cropTarget, setCropTarget] = useState<{ key: string; image: FanPageImageProps } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetKey = useRef('image')

  const section = document.sections.find((s) => s.id === selectedSectionId)

  const uploadImage = async (file: File, propKey: string) => {
    const validationError = validatePortalUpload(file, PORTAL_ASSET_RULES)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setUploading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(t('fanPage_upload_error'))
        return
      }

      const body = new FormData()
      body.append('file', file)

      const response = await fetch(
        `/api/portal/upload-asset?artistId=${artistId}&source=landing`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body,
        },
      )

      if (!response.ok) {
        toast.error(t('fanPage_upload_error'))
        return
      }

      const payload = (await response.json()) as { asset: { publicUrl: string } }
      if (!section) return

      if (propKey === 'gallery') {
        const existing = (section.props.images as FanPageImageProps[] | undefined) ?? []
        updateSectionProps(section.id, {
          images: [...existing, { src: payload.asset.publicUrl, alt: '', focalX: 50, focalY: 50 }],
        })
      } else {
        updateSectionProps(section.id, {
          [propKey]: {
            src: payload.asset.publicUrl,
            alt: '',
            focalX: 50,
            focalY: 50,
            objectFit: 'cover',
          },
        })
      }
      toast.success(t('fanPage_upload_success'))
    } catch {
      toast.error(t('fanPage_upload_error'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const patchImage = (key: string, patch: Partial<FanPageImageProps>) => {
    if (!section) return
    const current = readImage(section.props, key) ?? {}
    updateSectionProps(section.id, { [key]: { ...current, ...patch } })
  }

  const openCrop = (key: string) => {
    if (!section) return
    const image = readImage(section.props, key)
    if (!image?.src) return
    setCropTarget({ key, image })
    setCropOpen(true)
  }

  const renderImageControls = (key: string, label: string) => {
    if (!section) return null
    const image = readImage(section.props, key)

    return (
      <div className="space-y-3 rounded-md border border-border p-3">
        <Label>{label}</Label>
        {image?.src ? (
          <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
            <Image src={image.src} alt="" fill unoptimized className="object-cover" />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => {
              uploadTargetKey.current = key
              fileInputRef.current?.click()
            }}
          >
            <UploadSimple size={16} className="mr-1.5" aria-hidden />
            {uploading ? t('fanPage_uploading') : t('fanPage_upload_image')}
          </Button>
          {image?.src ? (
            <Button type="button" variant="outline" size="sm" onClick={() => openCrop(key)}>
              <Crop size={16} className="mr-1.5" aria-hidden />
              {t('fanPage_crop_image')}
            </Button>
          ) : null}
        </div>
        {image?.src ? (
          <>
            <div className="space-y-2">
              <Label>{t('fanPage_focal_x')}</Label>
              <Slider
                value={[image.focalX ?? 50]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => patchImage(key, { focalX: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('fanPage_focal_y')}</Label>
              <Slider
                value={[image.focalY ?? 50]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => patchImage(key, { focalY: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('fanPage_image_scale')}</Label>
              <Slider
                value={[image.scale ?? 1]}
                min={1}
                max={2}
                step={0.05}
                onValueChange={([v]) => patchImage(key, { scale: v })}
              />
            </div>
          </>
        ) : null}
      </div>
    )
  }

  if (!section) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        {t('fanPage_no_section')}
      </div>
    )
  }

  const props = section.props
  const deviceStyles = previewDevice === 'mobile' ? section.styles.mobile ?? {} : section.styles.desktop

  return (
    <div className="rounded-lg border border-border bg-card" data-lenis-prevent>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void uploadImage(file, uploadTargetKey.current)
        }}
      />

      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t('fanPage_properties_title')}</h2>
        <p className="text-xs text-muted-foreground capitalize">{section.type.replace(/_/g, ' ')}</p>
      </div>

      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <Label>{t('fanPage_padding')}</Label>
          <Select
            value={deviceStyles.paddingY ?? 'md'}
            onValueChange={(v) =>
              updateSection(section.id, {
                styles: {
                  ...section.styles,
                  [previewDevice]: { ...deviceStyles, paddingY: v as 'none' | 'sm' | 'md' | 'lg' },
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="sm">Small</SelectItem>
              <SelectItem value="md">Medium</SelectItem>
              <SelectItem value="lg">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {section.type === 'hero' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="fp-headline">{t('fanPage_headline')}</Label>
              <Input
                id="fp-headline"
                value={(props.headline as string) ?? ''}
                onChange={(e) => updateSectionProps(section.id, { headline: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp-subheadline">{t('fanPage_subheadline')}</Label>
              <Input
                id="fp-subheadline"
                value={(props.subheadline as string) ?? ''}
                onChange={(e) => updateSectionProps(section.id, { subheadline: e.target.value })}
              />
            </div>
            {renderImageControls('image', t('fanPage_hero_image'))}
          </>
        )}

        {section.type === 'bio' && (
          <div className="space-y-2">
            <Label>{t('fanPage_bio_content')}</Label>
            <TiptapEditor
              compact
              value={(props.content as string) ?? ''}
              onChange={(html) => updateSectionProps(section.id, { content: html })}
            />
          </div>
        )}

        {(section.type === 'release_grid' || section.type === 'video_grid' || section.type === 'tour_dates') && (
          <div className="space-y-2">
            <Label htmlFor="fp-limit">{t('fanPage_limit')}</Label>
            <Input
              id="fp-limit"
              type="number"
              min={1}
              max={24}
              value={Number(props.limit ?? 6)}
              onChange={(e) => updateSectionProps(section.id, { limit: Number(e.target.value) })}
            />
          </div>
        )}

        {section.type === 'cta_banner' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="fp-cta-label">{t('fanPage_cta_label')}</Label>
              <Input
                id="fp-cta-label"
                value={(props.label as string) ?? ''}
                onChange={(e) => updateSectionProps(section.id, { label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp-cta-url">{t('fanPage_cta_url')}</Label>
              <Input
                id="fp-cta-url"
                value={(props.url as string) ?? ''}
                onChange={(e) => updateSectionProps(section.id, { url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp-cta-headline">{t('fanPage_headline')}</Label>
              <Input
                id="fp-cta-headline"
                value={(props.headline as string) ?? ''}
                onChange={(e) => updateSectionProps(section.id, { headline: e.target.value })}
              />
            </div>
            {renderImageControls('image', t('fanPage_background_image'))}
          </>
        )}

        {section.type === 'merch_shelf' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="fp-shop-url">{t('fanPage_shop_url')}</Label>
              <Input
                id="fp-shop-url"
                value={(props.shopUrl as string) ?? ''}
                onChange={(e) => updateSectionProps(section.id, { shopUrl: e.target.value })}
              />
            </div>
            {renderImageControls('image', t('fanPage_merch_image'))}
          </>
        )}

        {section.type === 'gallery' && (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => {
                uploadTargetKey.current = 'gallery'
                fileInputRef.current?.click()
              }}
            >
              <ImageIcon size={16} className="mr-1.5" aria-hidden />
              {t('fanPage_add_gallery_image')}
            </Button>
          </div>
        )}

        {section.type === 'spacer' && (
          <div className="space-y-2">
            <Label>{t('fanPage_spacer_size')}</Label>
            <Select
              value={(props.size as string) ?? 'md'}
              onValueChange={(v) => updateSectionProps(section.id, { size: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {section.type === 'newsletter_signup' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="fp-nl-heading">{t('fanPage_headline')}</Label>
              <Input
                id="fp-nl-heading"
                value={(props.heading as string) ?? ''}
                onChange={(e) => updateSectionProps(section.id, { heading: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp-nl-desc">{t('fanPage_description')}</Label>
              <Textarea
                id="fp-nl-desc"
                value={(props.description as string) ?? ''}
                onChange={(e) => updateSectionProps(section.id, { description: e.target.value })}
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="fp-section-title">{t('fanPage_section_title')}</Label>
          <Input
            id="fp-section-title"
            value={(props.title as string) ?? ''}
            onChange={(e) => updateSectionProps(section.id, { title: e.target.value })}
          />
        </div>
      </div>

      {cropTarget ? (
        <EpkImageCropDialog
          open={cropOpen}
          src={cropTarget.image.src ?? ''}
          crop={cropTarget.image.crop as ImageCrop | undefined}
          onClose={() => {
            setCropOpen(false)
            setCropTarget(null)
          }}
          onApply={(crop) => {
            if (!section) return
            patchImage(cropTarget.key, { crop })
            setCropOpen(false)
            setCropTarget(null)
          }}
        />
      ) : null}
    </div>
  )
}