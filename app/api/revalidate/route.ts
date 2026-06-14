/**
 * app/api/revalidate/route.ts — Generic on-demand cache revalidation endpoint.
 *
 * Called by Supabase Database Webhooks (or any trusted server) when content
 * changes in the CMS so the Next.js ISR cache is busted immediately.
 *
 * Security:
 *   The caller must pass the REVALIDATE_SECRET in the Authorization header:
 *     Authorization: ******
 *
 * Accepted tags: artists | releases | news | videos | site-settings
 *   Omit the `tags` field to revalidate ALL content tags at once.
 *
 * Granular entity tags (optional):
 *   Pass `entityTag` with the specific entity slug/id to revalidate only that
 *   one page without invalidating every list page.
 *   Pattern: "artist-{slug}" | "release-{id}" | "news-{slug}"
 *
 * Example Supabase Webhook payload (single artist update):
 *   POST /api/revalidate
 *   Authorization: ******
 *   Content-Type: application/json
 *   { "tags": ["artists"], "entityTag": "artist-my-band-slug" }
 *
 * Example for a full content flush:
 *   POST /api/revalidate
 *   Authorization: ******
 *   Content-Type: application/json
 *   { "tags": ["releases", "artists"] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { buildApiError, withErrorHandler } from '@/lib/errors'

const ALL_TAGS = ['artists', 'releases', 'news', 'videos', 'site-settings'] as const
type CacheTag = (typeof ALL_TAGS)[number]

const bodySchema = z.object({
  tags: z.array(z.enum(ALL_TAGS)).optional(),
  /**
   * Optional granular entity tag. If provided, revalidateTag is also called for
   * this entity-specific tag in addition to any list-level tags.
   * Pattern: "artist-{slug}" | "release-{uuid}" | "news-{slug}"
   */
  entityTag: z
    .string()
    .regex(/^(artist|release|news)-[\w-]+$/)
    .optional(),
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Authenticate with shared secret
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) {
    throw buildApiError('CONFIG_ERROR', 503)
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (token !== secret) {
    throw buildApiError('AUTH_TOKEN_INVALID', 401)
  }

  // Parse body — tolerate empty body (Supabase sends minimal payloads)
  let tags: CacheTag[]
  let entityTag: string | undefined
  try {
    const rawBody = await request.text()
    const body = rawBody ? (JSON.parse(rawBody) as unknown) : {}
    const parsed = bodySchema.safeParse(body)
    tags = parsed.success && parsed.data.tags ? parsed.data.tags : [...ALL_TAGS]
    entityTag = parsed.success ? parsed.data.entityTag : undefined
  } catch {
    tags = [...ALL_TAGS]
    entityTag = undefined
  }

  // Revalidate each requested list-level tag
  for (const tag of tags) {
    revalidateTag(tag)
  }

  // Revalidate the specific entity page if provided (e.g. only artist-my-slug)
  if (entityTag) {
    revalidateTag(entityTag)
  }

  return NextResponse.json({ revalidated: true, tags, entityTag })
})
