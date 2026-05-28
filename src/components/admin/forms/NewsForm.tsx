'use client'
import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
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
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

type Props = AdminPanelProps<NewsFormData>

export function NewsForm({ value, onChange, isLoading }: Props) {
  const { register, handleSubmit, watch, setValue, reset, control } = useForm<NewsFormData>({
    defaultValues: value,
  })

  const [htmlContent, setHtmlContent] = useState(value?.content ?? '')

  useEffect(() => {
    reset(value)
    setHtmlContent(value?.content ?? '')
  }, [value, reset])

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

      <Button type="submit" disabled={isLoading} className="w-full">
        Save News Post
      </Button>
    </form>
  )
}
