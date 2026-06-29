/**
 * app/api/revalidate-content/route.ts
 *
 * Called by Admin CMS client hooks after create/update/delete mutations to
 * bust the Next.js ISR cache so the public frontend immediately reflects
 * the new content without waiting for the 60-second revalidation window.
 *
 * Security: only authenticated admin/editor users may trigger revalidation.
 * The caller must pass the Supabase session ******
 *
 * Body:
 *   {
 *     tags: Array<'artists' | 'releases' | 'news' | 'videos' | 'concerts'>,
 *     // Optional entity-specific tags for granular invalidation
 *     entityTags?: string[]   // e.g. ['artist-some-slug', 'release-uuid-here']
 *   }
 *
 * Entity-specific tags follow these patterns:
 *   'artist-{slug}'  → invalidates only the specific artist detail page
 *   'release-{id}'   → invalidates only the specific release detail page
 *   'news-{slug}'    → invalidates only the specific news article page
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'

const CONTENT_TAGS = ['artists', 'releases', 'news', 'videos', 'concerts'] as const
type ContentTag = (typeof CONTENT_TAGS)[number]

const bodySchema = z.object({
  tags: z.array(z.enum(CONTENT_TAGS)).min(1),
  /** Optional granular entity tags, e.g. ['artist-my-artist', 'release-abc-123'] */
  entityTags: z
    .array(
      z
        .string()
        .min(1)
        .max(256)
        .regex(/^(artist|release|news)-[\w-]+$/, {
          message: 'entityTags must match pattern: (artist|release|news)-{identifier}',
        }),
    )
    .optional(),
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new ApiError(401, 'Unauthorized')
  }

  // Verify the user has admin or editor role
  const role = await getUserRoleWithClient(supabase, user.id)

  if (!role || !['admin', 'editor'].includes(role)) {
    throw new ApiError(403, 'Forbidden')
  }

  // Parse and validate body
  let tags: ContentTag[]
  let entityTags: string[]
  try {
    const body: unknown = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid or missing tags')
    }
    tags = parsed.data.tags
    entityTags = parsed.data.entityTags ?? []
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw new ApiError(400, 'Invalid JSON body')
  }

  for (const tag of tags) {
    revalidateTag(tag, 'max')
  }

  // Revalidate granular entity-specific tags (e.g. after updating a single artist)
  for (const tag of entityTags) {
    revalidateTag(tag, 'max')
  }

  return NextResponse.json({ revalidated: true, tags, entityTags })
})
