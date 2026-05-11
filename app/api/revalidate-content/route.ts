/**
 * app/api/revalidate-content/route.ts
 *
 * Called by Admin CMS client hooks after create/update/delete mutations to
 * bust the Next.js ISR cache so the public frontend immediately reflects
 * the new content without waiting for the 60-second revalidation window.
 *
 * Security: only authenticated admin/editor users may trigger revalidation.
 * The caller must pass the Supabase session Bearer token.
 *
 * Body: { tags: Array<'artists' | 'releases' | 'news' | 'videos' | 'concerts'> }
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const CONTENT_TAGS = ['artists', 'releases', 'news', 'videos', 'concerts'] as const
type ContentTag = (typeof CONTENT_TAGS)[number]

const bodySchema = z.object({
  tags: z.array(z.enum(CONTENT_TAGS)).min(1),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the user has admin or editor role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'editor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse and validate body
    let tags: ContentTag[]
    try {
      const body: unknown = await request.json()
      const parsed = bodySchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid or missing tags' }, { status: 400 })
      }
      tags = parsed.data.tags
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    for (const tag of tags) {
      revalidateTag(tag)
    }

    return NextResponse.json({ revalidated: true, tags })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
