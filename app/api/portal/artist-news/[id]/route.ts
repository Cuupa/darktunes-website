/**
 * PATCH  /api/portal/artist-news/{id}?artist_id= — update a band news post
 * DELETE /api/portal/artist-news/{id}?artist_id= — delete a band news post
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import {
  ARTIST_NEWS_CONTENT_MAX,
  ARTIST_NEWS_TITLE_MAX,
  deleteArtistNewsPost,
  excerptFromContent,
  getArtistNewsById,
  listArtistNewsSlugs,
  toArtistNewsJson,
  uniqueArtistNewsSlug,
  updateArtistNewsPost,
} from '@/lib/api/artistNews'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { stripEmojis, stripEmojisFromHtml } from '@/lib/stripEmojis'

const patchBodySchema = z.object({
  title: z.string().trim().min(1).max(ARTIST_NEWS_TITLE_MAX).optional(),
  content: z.string().max(ARTIST_NEWS_CONTENT_MAX).optional(),
  image_url: z.string().url().nullable().optional(),
  status: z.enum(['draft', 'published']).optional(),
})

function artistIdFromReq(req: NextRequest): string | null {
  return req.nextUrl.searchParams.get('artist_id') ?? req.nextUrl.searchParams.get('artistId')
}

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? ''
}

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const id = extractId(req)
  const membership = await withPortalMembershipWrite(req, artistIdFromReq(req))

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
  const parsed = patchBodySchema.safeParse(raw)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid news payload')
  }

  const { value: updated } = await portalMemberWrite(
    membership,
    { route: 'PATCH /api/portal/artist-news/[id]', table: 'artist_news_posts', operation: 'update' },
    async (db) => {
      const existing = await getArtistNewsById(db, id)
      if (!existing || existing.artistId !== membership.artist.id) {
        throw new ApiError(404, 'News post not found')
      }
      const title = parsed.data.title !== undefined ? stripEmojis(parsed.data.title) : existing.title
      const content =
        parsed.data.content !== undefined ? stripEmojisFromHtml(parsed.data.content) : existing.content
      const status = parsed.data.status ?? existing.status
      let slug = existing.slug
      if (parsed.data.title !== undefined && title !== existing.title) {
        const slugs = (await listArtistNewsSlugs(db, membership.artist.id)).filter((s) => s !== existing.slug)
        slug = uniqueArtistNewsSlug(title, slugs)
      }
      let publishedAt = existing.publishedAt ?? null
      if (status === 'published' && !publishedAt) publishedAt = new Date().toISOString()
      if (status === 'draft') publishedAt = null
      return updateArtistNewsPost(db, id, {
        title,
        slug,
        content,
        excerpt: excerptFromContent(content),
        image_url: parsed.data.image_url === undefined ? existing.imageUrl ?? null : parsed.data.image_url,
        status,
        published_at: publishedAt,
      })
    },
  )

  return NextResponse.json(toArtistNewsJson(updated))
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const id = extractId(req)
  const membership = await withPortalMembershipWrite(req, artistIdFromReq(req))

  await portalMemberWrite(
    membership,
    { route: 'DELETE /api/portal/artist-news/[id]', table: 'artist_news_posts', operation: 'delete' },
    async (db) => {
      const existing = await getArtistNewsById(db, id)
      if (!existing || existing.artistId !== membership.artist.id) {
        throw new ApiError(404, 'News post not found')
      }
      await deleteArtistNewsPost(db, id)
    },
  )

  return new NextResponse(null, { status: 204 })
})
