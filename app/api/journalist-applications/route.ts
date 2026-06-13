/**
 * app/api/journalist-applications/route.ts
 *
 * GET  — Admin: list all journalist applications (service-role client)
 * POST — Public: submit a journalist application (user's own record)
 */

import { withErrorHandler, ApiError } from '@/lib/errors'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  getJournalistApplications,
  createJournalistApplication,
} from '@/lib/api/journalistApplications'
import { z } from 'zod'

const ApplySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  outlet: z.string().min(1),
  message: z.string().optional(),
})

export const GET = withErrorHandler(async () => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new ApiError(401, 'Unauthorized')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') throw new ApiError(403, 'Forbidden')

  const db = await createServiceRoleSupabaseClient()
  const applications = await getJournalistApplications(db)
  return NextResponse.json({ applications })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json()
  const { email, name, outlet, message } = ApplySchema.parse(body)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Use service-role so the insert can bypass the user_id RLS check when unauthenticated
  const db = await createServiceRoleSupabaseClient()
  const application = await createJournalistApplication(db, {
    email,
    name,
    outlet,
    message: message ?? null,
    user_id: user?.id ?? null,
  })
  return NextResponse.json({ application }, { status: 201 })
})
