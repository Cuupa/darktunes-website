'use client'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import type { AdminPanelProps } from '@/lib/component-contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export interface NewsFormData {
  title: string
  slug: string
  excerpt: string
  content: string
  imageUrl: string
  publishedAt: string
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
  const { register, handleSubmit, watch, setValue, reset } = useForm<NewsFormData>({
    defaultValues: value,
  })

  useEffect(() => {
    reset(value)
  }, [value, reset])

  const title = watch('title')
  const slugValue = watch('slug')

  // Track whether the slug was auto-generated so we stop overwriting manual edits
  const lastAutoSlug = useRef(toSlug(title))
  useEffect(() => {
    const auto = toSlug(title)
    if (!slugValue || slugValue === lastAutoSlug.current) {
      setValue('slug', auto)
      lastAutoSlug.current = auto
    }
  }, [title, slugValue, setValue])

  return (
    <form onSubmit={handleSubmit(onChange)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" {...register('title', { required: true })} disabled={isLoading} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="slug">Slug *</Label>
        <Input id="slug" {...register('slug', { required: true })} disabled={isLoading} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Textarea id="excerpt" {...register('excerpt')} rows={2} disabled={isLoading} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="content">Content *</Label>
        <Textarea id="content" {...register('content', { required: true })} rows={6} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="imageUrl">Image URL</Label>
          <Input id="imageUrl" {...register('imageUrl')} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="publishedAt">Published At</Label>
          <Input id="publishedAt" type="date" {...register('publishedAt')} disabled={isLoading} />
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        Save News Post
      </Button>
    </form>
  )
}
