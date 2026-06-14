import { NextRequest, NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { z } from 'zod'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateFeatureFlag } from '@/lib/api/featureFlags'

const schema = z.object({
  enabled: z.boolean(),
})

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const role = await getUserRoleWithClient(supabase, user.id)
  if (role !== 'admin') throw new ApiError(403, 'Forbidden')

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) throw new ApiError(400, 'Invalid payload', 'VALIDATION_ERROR')

  const flag = await updateFeatureFlag(supabase, extractId(req), parsed.data.enabled)
  return NextResponse.json({ flag })
})
