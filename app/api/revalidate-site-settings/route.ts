/**
 * app/api/revalidate-site-settings/route.ts
 *
 * Called by the Admin CMS after saving site settings to bust the Next.js
 * ISR cache so the public frontend immediately reflects the new content.
 *
 * Security: only authenticated admin/editor users may trigger revalidation.
 * The caller must pass the Supabase session ******
 */

import { NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { revalidateTag } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'

export const POST = withErrorHandler(async () => {
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

  revalidateTag('site-settings')
  return NextResponse.json({ revalidated: true })
})
