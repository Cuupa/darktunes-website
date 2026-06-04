'use client'
import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getArtists } from '@/lib/api/artists'
import type { AdminPanelProps } from '@/lib/component-contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImageUploadButton } from './ImageUploadButton'
import { TiptapEditor } from '@/components/admin/TiptapEditor'

export interface NewsFormData {
  title: string
  slug: string
  excerpt: string
  content: string
  imageUrl: string
  publishedAt: string
  scheduledAt: string
  isPressOnly: boolean
  status: 'draft' | 'published' | 'scheduled' | 'archived'
  artistId: string
  embargoUntil?: string
  mediaContact?: string
  releaseCategory?: string
  heroPrimaryBtnLabel: string
  heroPrimaryBtnAction: '' | 'link' | 'scroll' | 'none'
  heroPrimaryBtnHref: string
  heroSecondaryBtnLabel: string
  heroSecondaryBtnAction: '' | 'link' | 'scroll' | 'none'
  heroSecondaryBtnHref: string
}

function toSlug(text: string): string {
  return text
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'ae')
    .replace(/Ö/g, 'oe')
    .replace(/Ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

type Props = AdminPanelProps<NewsFormData>

export function NewsForm({ value, onChange, isLoading }: Props) {
  const { register, handleSubmit, watch, setValue, reset, control } = useForm<NewsFormData>({
    defaultValues: value,
  })

  const [htmlContent, setHtmlContent] = useState(value?.content ?? '')
  const [artists, setArtists] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    reset(value)
    setHtmlContent(value?.content ?? '')
  }, [value, reset])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    getArtists(supabase).then((rows) =>
      setArtists(rows.map((a) => ({ id: a.id, name: a.name })))
    ).catch(() => {})
  }, [])

  const title = watch('title')
  const slugValue = watch('slug')
  const status = watch('status')

  // Track whether the slug was auto-generated so we stop overwriting manual edits
  const lastAutoSlug = useRef(toSlug(title))
  useEffect(() => {
    const auto = toSlug(title)
    if (!slugValue || slugValue === lastAutoSlug.current) {
      setValue('slug', auto)
      lastAutoSlug.current = auto
    }
  }, [title, slugValue, setValue])

  const isPressOnly = watch('isPressOnly')
  const heroPrimaryBtnAction = watch('heroPrimaryBtnAction')
  const heroSecondaryBtnAction = watch('heroSecondaryBtnAction')

  const onSubmit = (data: NewsFormData) => {
    onChange({ ...data, content: htmlContent })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-1">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" {...register('title', { required: true })} disabled={isLoading} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="slug">Slug *</Label>
        <Input id="slug" {...register('slug', { required: true })} disabled={isLoading} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="excerpt">Excerpt (shown in listings)</Label>
        <Textarea id="excerpt" {...register('excerpt')} rows={2} disabled={isLoading} />
      </div>

      <div className="space-y-1">
        <Label>Content *</Label>
        <TiptapEditor
          value={htmlContent}
          onChange={setHtmlContent}
          disabled={isLoading}
          placeholder="Write your news post here…"
        />
      </div>

      {/* Artist association */}
      <div className="space-y-1">
        <Label htmlFor="artistId">Artist (optional)</Label>
        <Controller
          name="artistId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onValueChange={(val) => field.onChange(val === '__none__' ? '' : val)}
              disabled={isLoading}
            >
              <SelectTrigger id="artistId">
                <SelectValue placeholder="General news (not tied to an artist)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">General news (no artist)</SelectItem>
                {artists.map((artist) => (
                  <SelectItem key={artist.id} value={artist.id}>
                    {artist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          If selected, this news post appears only on that artist&apos;s profile page.
        </p>
      </div>

      {/* Status + scheduling */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(val) => field.onChange(val as NewsFormData['status'])}
                disabled={isLoading}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="publishedAt">
            {status === 'scheduled' ? 'Publish At (date & time)' : 'Published At'}
          </Label>
          <Input
            id="publishedAt"
            type="datetime-local"
            {...register('publishedAt')}
            disabled={isLoading}
          />
          {status === 'scheduled' && (
            <p className="text-xs text-muted-foreground">
              Post will go live automatically at this time.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="imageUrl">Image URL</Label>
        <div className="flex gap-2">
          <Input id="imageUrl" {...register('imageUrl')} disabled={isLoading} className="flex-1" />
          <ImageUploadButton
            label="Upload"
            onUploaded={(url) => setValue('imageUrl', url)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="isPressOnly"
          checked={isPressOnly}
          onCheckedChange={(val) => setValue('isPressOnly', val)}
          disabled={isLoading}
        />
        <Label htmlFor="isPressOnly">Press-only</Label>
      </div>

      {isPressOnly && (
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="embargoUntil">Embargo Until</Label>
            <Input id="embargoUntil" type="datetime-local" {...register('embargoUntil')} disabled={isLoading} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="releaseCategory">Release Category</Label>
            <Input id="releaseCategory" {...register('releaseCategory')} disabled={isLoading} placeholder="album announcement" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="mediaContact">Media Contact</Label>
            <Input id="mediaContact" {...register('mediaContact')} disabled={isLoading} placeholder="press@darktunes.com" />
          </div>
        </div>
      )}

      {/* ── Hero Buttons ── */}
      <div className="space-y-4 rounded-lg border border-border p-4">
        <p className="text-sm font-semibold text-foreground">Hero Buttons</p>
        <p className="text-xs text-muted-foreground -mt-2">
          Customise the two CTA buttons shown in the Hero section for this news post.
          Leave fields empty to use the site defaults.
        </p>

        {/* Primary button */}
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Primary Button (filled)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="heroPrimaryBtnLabel">Label</Label>
              <Input
                id="heroPrimaryBtnLabel"
                {...register('heroPrimaryBtnLabel')}
                disabled={isLoading}
                placeholder="e.g. Read More"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="heroPrimaryBtnAction">Action</Label>
              <Controller
                name="heroPrimaryBtnAction"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || '__default__'}
                    onValueChange={(val) => field.onChange(val === '__default__' ? '' : val)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="heroPrimaryBtnAction">
                      <SelectValue placeholder="Default (go to news article)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">Default (go to news article)</SelectItem>
                      <SelectItem value="link">Link — URL or internal path</SelectItem>
                      <SelectItem value="scroll">Scroll — jump to page section</SelectItem>
                      <SelectItem value="none">Hidden — don&apos;t show this button</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          {heroPrimaryBtnAction === 'link' && (
            <div className="space-y-1">
              <Label htmlFor="heroPrimaryBtnHref">URL / Path</Label>
              <Input
                id="heroPrimaryBtnHref"
                {...register('heroPrimaryBtnHref')}
                disabled={isLoading}
                placeholder="e.g. /releases/xyz or https://…"
              />
            </div>
          )}
          {heroPrimaryBtnAction === 'scroll' && (
            <div className="space-y-1">
              <Label htmlFor="heroPrimaryBtnHref-scroll">Section target</Label>
              <Select
                value={watch('heroPrimaryBtnHref')}
                onValueChange={(val) => setValue('heroPrimaryBtnHref', val)}
                disabled={isLoading}
              >
                <SelectTrigger id="heroPrimaryBtnHref-scroll">
                  <SelectValue placeholder="Select section…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="#releases">Releases</SelectItem>
                  <SelectItem value="#videos">Videos</SelectItem>
                  <SelectItem value="#concerts">Concerts</SelectItem>
                  <SelectItem value="#news">News</SelectItem>
                  <SelectItem value="#newsletter">Newsletter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Secondary button */}
        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Secondary Button (outline)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="heroSecondaryBtnLabel">Label</Label>
              <Input
                id="heroSecondaryBtnLabel"
                {...register('heroSecondaryBtnLabel')}
                disabled={isLoading}
                placeholder="e.g. Browse News"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="heroSecondaryBtnAction">Action</Label>
              <Controller
                name="heroSecondaryBtnAction"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || '__default__'}
                    onValueChange={(val) => field.onChange(val === '__default__' ? '' : val)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="heroSecondaryBtnAction">
                      <SelectValue placeholder="Default (scroll to news)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">Default (scroll to news)</SelectItem>
                      <SelectItem value="link">Link — URL or internal path</SelectItem>
                      <SelectItem value="scroll">Scroll — jump to page section</SelectItem>
                      <SelectItem value="none">Hidden — don&apos;t show this button</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          {heroSecondaryBtnAction === 'link' && (
            <div className="space-y-1">
              <Label htmlFor="heroSecondaryBtnHref">URL / Path</Label>
              <Input
                id="heroSecondaryBtnHref"
                {...register('heroSecondaryBtnHref')}
                disabled={isLoading}
                placeholder="e.g. /artists/xyz or https://…"
              />
            </div>
          )}
          {heroSecondaryBtnAction === 'scroll' && (
            <div className="space-y-1">
              <Label htmlFor="heroSecondaryBtnHref-scroll">Section target</Label>
              <Select
                value={watch('heroSecondaryBtnHref')}
                onValueChange={(val) => setValue('heroSecondaryBtnHref', val)}
                disabled={isLoading}
              >
                <SelectTrigger id="heroSecondaryBtnHref-scroll">
                  <SelectValue placeholder="Select section…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="#releases">Releases</SelectItem>
                  <SelectItem value="#videos">Videos</SelectItem>
                  <SelectItem value="#concerts">Concerts</SelectItem>
                  <SelectItem value="#news">News</SelectItem>
                  <SelectItem value="#newsletter">Newsletter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        Save News Post
      </Button>
    </form>
  )
}
