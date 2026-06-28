/**
 * PATCH /api/account/display-name
 * Lets any authenticated user update their own display name (users.full_name).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { DISPLAY_NAME_MAX_LENGTH, updateUserDisplayName } from '@/lib/api/users'

const bodySchema = z.object({
  displayName: z.string().max(DISPLAY_NAME_MAX_LENGTH).nullable().optional(),
})

export const PATCH = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const body: unknown = await request.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ')
    throw new ApiError(400, message, 'VALIDATION_ERROR')
  }

  const displayName = await updateUserDisplayName(supabase, user.id, parsed.data.displayName)

  return NextResponse.json({ displayName })
})