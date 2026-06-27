/**
 * POST /api/admin/support/tickets
 * Auth: admin only
 * Body: { subject: string, message: string }
 *
 * Queues a manual support ticket for background delivery to Zammad.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { resolveUserProfile } from '@/lib/api/zammadSupport'
import { submitManualTicket } from '@/lib/zammad/submitTicket'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (typeof body !== 'object' || body === null) {
    throw new ApiError(400, 'Body must be a JSON object')
  }

  const { subject, message } = body as Record<string, unknown>

  if (typeof subject !== 'string' || !subject.trim()) {
    throw new ApiError(400, 'Field "subject" is required')
  }
  if (typeof message !== 'string' || !message.trim()) {
    throw new ApiError(400, 'Field "message" is required')
  }
  if (subject.length > 200) {
    throw new ApiError(400, 'Subject must be at most 200 characters')
  }
  if (message.length > 10_000) {
    throw new ApiError(400, 'Message must be at most 10,000 characters')
  }

  const db = await createServiceRoleSupabaseClient()
  const { data: authData } = await db.auth.admin.getUserById(userId)
  const profile = await resolveUserProfile(
    db,
    userId,
    authData?.user?.email,
    authData?.user?.user_metadata?.full_name as string | undefined,
  )

  submitManualTicket({
    userId,
    customerEmail: profile.email,
    customerName: profile.name,
    subject: subject.trim(),
    message: message.trim(),
  })

  return NextResponse.json({ ok: true }, { status: 202 })
})