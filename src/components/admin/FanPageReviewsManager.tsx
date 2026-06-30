'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowSquareOut, Globe } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { FanPageReviewListItem } from '@/lib/api/fanPageDocument'
import type { FanPagePublishStatus } from '@/lib/fan-page/schema/documentV1'
import { getPublicFanPagePath } from '@/lib/fan-page/urls'
import { FanPageReviewPreview } from './FanPageReviewPreview'

type StatusFilter = 'pending_review' | 'all' | FanPagePublishStatus

const STATUS_LABELS: Record<FanPagePublishStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  published: 'Published',
  rejected: 'Rejected',
}

function statusBadgeVariant(status: FanPagePublishStatus) {
  switch (status) {
    case 'pending_review':
      return 'secondary'
    case 'published':
      return 'default'
    case 'rejected':
      return 'destructive'
    default:
      return 'outline'
  }
}

async function getToken(): Promise<string> {
  const session = await createBrowserSupabaseClient().auth.getSession()
  return session.data.session?.access_token ?? ''
}

export function FanPageReviewsManager() {
  const [filter, setFilter] = useState<StatusFilter>('pending_review')
  const [reviews, setReviews] = useState<FanPageReviewListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<FanPageReviewListItem | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [trustedSaving, setTrustedSaving] = useState(false)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const query = filter === 'all' ? '' : `?status=${encodeURIComponent(filter)}`
      const res = await fetch(`/api/admin/fan-page/reviews${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load')
      const data = (await res.json()) as FanPageReviewListItem[]
      setReviews(data)
      setSelected((current) => {
        if (!current) return null
        return data.find((item) => item.artistId === current.artistId) ?? current
      })
    } catch {
      toast.error('Failed to load fan page reviews')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void fetchReviews()
  }, [fetchReviews])

  const openDetail = (item: FanPageReviewListItem) => {
    setSelected(item)
    setReviewComment(item.reviewComment ?? '')
  }

  const submitReview = async (approved: boolean) => {
    if (!selected) return
    setSaving(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/fan-page/review/${selected.artistId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approved,
          comment: reviewComment.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('Review failed')
      toast.success(approved ? 'Fan page approved and published' : 'Fan page rejected')
      setSelected(null)
      setReviewComment('')
      await fetchReviews()
    } catch {
      toast.error('Failed to update fan page review')
    } finally {
      setSaving(false)
    }
  }

  const updateTrusted = async (trusted: boolean) => {
    if (!selected) return
    setTrustedSaving(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/fan-page/review/${selected.artistId}/trusted`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trusted }),
      })
      if (!res.ok) throw new Error('Trusted update failed')
      setSelected({ ...selected, landingPublishTrusted: trusted })
      setReviews((prev) =>
        prev.map((item) =>
          item.artistId === selected.artistId
            ? { ...item, landingPublishTrusted: trusted }
            : item,
        ),
      )
      toast.success(
        trusted
          ? 'Artist can publish fan pages without review'
          : 'Artist must submit fan pages for review',
      )
    } catch {
      toast.error('Failed to update trusted publish setting')
    } finally {
      setTrustedSaving(false)
    }
  }

  if (loading && reviews.length === 0) {
    return <p className="text-muted-foreground">Loading…</p>
  }

  return (
    <div className="space-y-4">
      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as StatusFilter)
          setSelected(null)
        }}
      >
        <TabsList aria-label="Filter fan pages by status">
          <TabsTrigger value="pending_review">Pending</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {selected ? (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Globe size={20} aria-hidden />
                {selected.artistName}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                ← Back
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="font-medium">Slug: </span>@{selected.artistSlug}
              </div>
              <div>
                <span className="font-medium">Status: </span>
                <Badge variant={statusBadgeVariant(selected.publishStatus)} className="ml-1">
                  {STATUS_LABELS[selected.publishStatus]}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Version: </span>
                {selected.documentVersion}
              </div>
              <div>
                <span className="font-medium">Last updated: </span>
                {new Date(selected.updatedAt).toLocaleString()}
              </div>
              {selected.seoTitle && (
                <div className="sm:col-span-2">
                  <span className="font-medium">SEO title: </span>
                  {selected.seoTitle}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-4">
              <div className="space-y-1">
                <Label htmlFor="fan-page-trusted-publish" className="text-sm font-medium">
                  Trusted fan page publish
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, this artist can publish fan pages directly without label review.
                </p>
              </div>
              <Switch
                id="fan-page-trusted-publish"
                checked={selected.landingPublishTrusted}
                disabled={trustedSaving}
                onCheckedChange={(checked) => void updateTrusted(checked)}
                aria-describedby="fan-page-trusted-publish-hint"
              />
            </div>

            <FanPageReviewPreview
              key={selected.artistId}
              artistId={selected.artistId}
              artistSlug={selected.artistSlug}
            />

            {selected.publishStatus === 'published' && (
              <Button type="button" variant="outline" asChild>
                <Link
                  href={getPublicFanPagePath(selected.artistSlug)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ArrowSquareOut size={16} className="mr-1.5" aria-hidden />
                  View live page
                </Link>
              </Button>
            )}

            {selected.publishStatus === 'pending_review' && (
              <div className="space-y-4 border-t border-border pt-4">
                <div className="space-y-2">
                  <Label htmlFor="fan-page-review-comment">Feedback to artist (optional)</Label>
                  <Textarea
                    id="fan-page-review-comment"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Reason for rejection or notes for the artist…"
                    maxLength={500}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => void submitReview(true)}
                  >
                    {saving ? 'Saving…' : 'Approve & publish'}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={saving}
                    onClick={() => void submitReview(false)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}

            {selected.reviewComment && selected.publishStatus !== 'pending_review' && (
              <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Review note: </span>
                {selected.reviewComment}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto overscroll-contain" data-lenis-prevent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 text-left">Artist</th>
                <th className="py-2 pr-4 text-left">Public URL</th>
                <th className="py-2 pr-4 text-left">Trusted</th>
                <th className="py-2 pr-4 text-left">Updated</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((item) => (
                <tr
                  key={item.artistId}
                  className="cursor-pointer border-b border-border hover:bg-muted/30"
                  onClick={() => openDetail(item)}
                >
                  <td className="py-2 pr-4 font-medium">{item.artistName}</td>
                  <td className="py-2 pr-4 text-muted-foreground">@{item.artistSlug}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {item.landingPublishTrusted ? 'Yes' : 'No'}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {new Date(item.updatedAt).toLocaleString()}
                  </td>
                  <td className="py-2">
                    <Badge variant={statusBadgeVariant(item.publishStatus)}>
                      {STATUS_LABELS[item.publishStatus]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {reviews.length === 0 && (
            <p className="py-4 text-muted-foreground">
              {filter === 'pending_review'
                ? 'No fan pages waiting for review.'
                : 'No fan pages in this filter.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}