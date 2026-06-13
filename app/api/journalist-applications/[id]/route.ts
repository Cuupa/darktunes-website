/**
 * app/api/journalist-applications/[id]/route.ts
 *
 * PATCH — Admin: approve or reject a journalist application.
 *         On approval, upgrades the applicant's profile role to 'journalist'.
 *         On rejection (after a prior approval), reverts the role to 'user'.
 */

import { withErrorHandler, ApiError } from '@/lib/errors'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { updateApplicationStatus } from '@/lib/api/journalistApplications'
import { z } from 'zod'

const UpdateSchema = z.object({
  status: z.enum(['approved', 'rejected']),
})

export const PATCH = withErrorHandler(async (req: NextRequest) => {
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

  const body = await req.json()
  const { status } = UpdateSchema.parse(body)

  // Extract the [id] segment from the URL path
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const id = segments[segments.length - 1]

  const db = await createServiceRoleSupabaseClient()
  const application = await updateApplicationStatus(db, id, status, user.id)

  // Promote the applicant's role on approval; demote on rejection
  if (application.userId) {
    const newRole = status === 'approved' ? 'journalist' : 'user'
    await db.from('users').update({ role: newRole }).eq('id', application.userId)
  }

  return NextResponse.json({ application })
})
