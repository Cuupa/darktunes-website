/**
 * GET  /api/admin/support/known-errors — list known error fingerprints
 * POST /api/admin/support/known-errors — add a known error fingerprint
 * Auth: admin only
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { createKnownError, listKnownErrors } from '@/lib/api/zammadSupport'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const db = await createServiceRoleSupabaseClient()
  const items = await listKnownErrors(db)

  return NextResponse.json({ items })
})

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

  const { fingerprint, label, notes } = body as Record<string, unknown>

  if (typeof fingerprint !== 'string' || !fingerprint.trim()) {
    throw new ApiError(400, 'Field "fingerprint" is required')
  }
  if (typeof label !== 'string' || !label.trim()) {
    throw new ApiError(400, 'Field "label" is required')
  }
  if (fingerprint.length > 128) {
    throw new ApiError(400, 'Fingerprint must be at most 128 characters')
  }

  const db = await createServiceRoleSupabaseClient()
  try {
    const item = await createKnownError(db, {
      fingerprint: fingerprint.trim(),
      label: label.trim(),
      notes: typeof notes === 'string' ? notes.trim() || null : null,
      createdBy: userId,
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('duplicate key') || err.message.includes('23505'))
    ) {
      throw new ApiError(409, 'This fingerprint is already registered')
    }
    throw err
  }
})