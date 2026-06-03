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
 * Body: { tags: Array<'artists' | 'releases' | 'news' | 'videos' | 'concerts'> }
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'

const CONTENT_TAGS = ['artists', 'releases', 'news', 'videos', 'concerts'] as const
type ContentTag = (typeof CONTENT_TAGS)[number]

const bodySchema = z.object({
  tags: z.array(z.enum(CONTENT_TAGS)).min(1),
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
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'editor'].includes(profile.role)) {
    throw new ApiError(403, 'Forbidden')
  }

  // Parse and validate body
  let tags: ContentTag[]
  try {
    const body: unknown = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid or missing tags')
    }
    tags = parsed.data.tags
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw new ApiError(400, 'Invalid JSON body')
  }

  for (const tag of tags) {
    revalidateTag(tag)
  }

  return NextResponse.json({ revalidated: true, tags })
})
