/**
 * app/api/revalidate/route.ts — Generic on-demand cache revalidation endpoint.
 *
 * Called by Supabase Database Webhooks (or any trusted server) when content
 * changes in the CMS so the Next.js ISR cache is busted immediately.
 *
 * Security:
 *   The caller must pass the REVALIDATE_SECRET in the Authorization header:
 *     Authorization: Bearer <REVALIDATE_SECRET>
 *
 * Accepted tags: artists | releases | news | videos | site-settings
 *   Omit the `tags` field to revalidate ALL content tags at once.
 *
 * Example Supabase Webhook payload:
 *   POST /api/revalidate
 *   Authorization: Bearer <secret>
 *   Content-Type: application/json
 *   { "tags": ["releases", "artists"] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'

const ALL_TAGS = ['artists', 'releases', 'news', 'videos', 'site-settings'] as const
type CacheTag = (typeof ALL_TAGS)[number]

const bodySchema = z.object({
  tags: z.array(z.enum(ALL_TAGS)).optional(),
})

export async function POST(request: NextRequest) {
  // Authenticate with shared secret
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Revalidation is not configured (REVALIDATE_SECRET not set)' },
      { status: 503 },
    )
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body — tolerate empty body (Supabase sends minimal payloads)
  let tags: CacheTag[]
  try {
    const rawBody = await request.text()
    const body = rawBody ? (JSON.parse(rawBody) as unknown) : {}
    const parsed = bodySchema.safeParse(body)
    tags = parsed.success && parsed.data.tags ? parsed.data.tags : [...ALL_TAGS]
  } catch {
    tags = [...ALL_TAGS]
  }

  // Revalidate each requested tag
  for (const tag of tags) {
    revalidateTag(tag)
  }

  return NextResponse.json({ revalidated: true, tags })
}
