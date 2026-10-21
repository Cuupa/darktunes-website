/**
 * GET  /api/portal/artist-news?artist_id= — list own band news
 * POST /api/portal/artist-news?artist_id= — create a band news post
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import {
  ARTIST_NEWS_CONTENT_MAX,
  ARTIST_NEWS_RATE_MAX,
  ARTIST_NEWS_RATE_WINDOW_MS,
  ARTIST_NEWS_TITLE_MAX,
  createArtistNewsPost,
  excerptFromContent,
  listArtistNewsByArtistId,
  listArtistNewsSlugs,
  toArtistNewsJson,
  uniqueArtistNewsSlug,
} from '@/lib/api/artistNews'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import { getClientIp } from '@/lib/ipRateLimit'
import { stripEmojis, stripEmojisFromHtml } from '@/lib/stripEmojis'

const createBodySchema = z.object({
  title: z.string().trim().min(1).max(ARTIST_NEWS_TITLE_MAX),
  content: z.string().max(ARTIST_NEWS_CONTENT_MAX).default(''),
  image_url: z.string().url().nullable().optional(),
  status: z.enum(['draft', 'published']).optional().default('draft'),
})

function artistIdFromReq(req: NextRequest): string | null {
  return req.nextUrl.searchParams.get('artist_id') ?? req.nextUrl.searchParams.get('artistId')
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const ctx = await withPortalMembershipWrite(req, artistIdFromReq(req))
  const { value: items } = await portalMemberWrite(
    ctx,
    { route: 'GET /api/portal/artist-news', table: 'artist_news_posts', operation: 'select' },
    (db) => listArtistNewsByArtistId(db, ctx.artist.id),
  )
  return NextResponse.json({ items: items.map(toArtistNewsJson) })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
  const parsed = createBodySchema.safeParse(raw)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid news payload')
  }

  const ctx = await withPortalMembershipWrite(req, artistIdFromReq(req))
  const ip = getClientIp(req)
  const rl = await checkDistributedRateLimit(
    `artist-news:${ctx.user.id}:${ip}`,
    ARTIST_NEWS_RATE_MAX,
    ARTIST_NEWS_RATE_WINDOW_MS,
  )
  if (rl.limited) throw new ApiError(429, 'Too many news posts. Wait a few minutes and try again.')

  const title = stripEmojis(parsed.data.title)
  const content = stripEmojisFromHtml(parsed.data.content)
  const status = parsed.data.status
  const now = new Date().toISOString()

  const { value: created } = await portalMemberWrite(
    ctx,
    { route: 'POST /api/portal/artist-news', table: 'artist_news_posts', operation: 'insert' },
    async (db) => {
      const slugs = await listArtistNewsSlugs(db, ctx.artist.id)
      return createArtistNewsPost(db, {
        artist_id: ctx.artist.id,
        title,
        slug: uniqueArtistNewsSlug(title, slugs),
        excerpt: excerptFromContent(content),
        content,
        image_url: parsed.data.image_url ?? null,
        status,
        published_at: status === 'published' ? now : null,
        created_by: ctx.user.id,
      })
    },
  )

  return NextResponse.json(toArtistNewsJson(created), {
    status: 201,
    headers: { Location: `/api/portal/artist-news/${created.id}` },
  })
})
