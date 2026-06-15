/**
 * app/api/admin/promo-log/route.ts
 *
 * GET  /api/admin/promo-log?artistId=<uuid>
 *   Returns all promo log entries for the given artist, newest first.
 *
 * POST /api/admin/promo-log
 *   Body: { artistId, actionDate, description, budgetAmount?, budgetCurrency?, proofUrl?, proofR2Key? }
 *   Creates a new promo log entry.
 *
 * DELETE /api/admin/promo-log
 *   Body: { id }
 *   Deletes the entry and removes its proof image from R2 (if present).
 *
 * Auth: ****** (admin or editor role required)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  getPromoLogEntries,
  createPromoLogEntry,
  updatePromoLogEntry,
  deletePromoLogEntry,
  getPromoLogEntryR2Key,
} from '@/lib/api/promoLog'
import { deleteObjectFromR2, createR2Client } from '@/lib/r2Utils'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createSchema = z.object({
  artistId: z.string().uuid(),
  actionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'actionDate must be YYYY-MM-DD'),
  description: z.string().min(1).max(1000),
  budgetAmount: z.number().nonnegative().nullable().optional(),
  budgetCurrency: z.string().length(3).toUpperCase().optional().default('EUR'),
  proofUrl: z.string().url().nullable().optional(),
  proofR2Key: z.string().nullable().optional(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  actionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().min(1).max(1000).optional(),
  budgetAmount: z.number().nonnegative().nullable().optional(),
  budgetCurrency: z.string().length(3).toUpperCase().optional(),
  proofUrl: z.string().url().nullable().optional(),
  proofR2Key: z.string().nullable().optional(),
})

const deleteSchema = z.object({ id: z.string().uuid() })

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)
  void userId

  const artistId = new URL(req.url).searchParams.get('artistId')
  if (!artistId) throw new ApiError(400, 'Missing artistId query parameter')

  const supabase = await createServerSupabaseClient()
  const entries = await getPromoLogEntries(supabase, artistId)
  return NextResponse.json({ entries })
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  const parsed = createSchema.parse(body)

  const supabase = await createServerSupabaseClient()
  const entry = await createPromoLogEntry(supabase, {
    artist_id: parsed.artistId,
    action_date: parsed.actionDate,
    description: parsed.description,
    budget_amount: parsed.budgetAmount ?? null,
    budget_currency: parsed.budgetCurrency ?? 'EUR',
    proof_url: parsed.proofUrl ?? null,
    proof_r2_key: parsed.proofR2Key ?? null,
    created_by: userId,
  })

  return NextResponse.json({ entry }, { status: 201 })
})

export const DELETE = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  const { id } = deleteSchema.parse(body)

  const supabase = await createServerSupabaseClient()

  // Retrieve R2 key before deletion so we can clean up the proof image
  const r2Key = await getPromoLogEntryR2Key(supabase, id).catch(() => null)

  await deletePromoLogEntry(supabase, id)

  // Best-effort R2 cleanup — failure does not block the DB deletion
  if (r2Key) {
    try {
      const { serverEnv } = await import('@/lib/env.server')
      const s3 = createR2Client(
        serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
        serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
        serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      )
      await deleteObjectFromR2(r2Key, s3, serverEnv.CLOUDFLARE_R2_BUCKET_NAME)
    } catch {
      // R2 cleanup is best-effort; log silently
    }
  }

  return NextResponse.json({ success: true })
})

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  const parsed = updateSchema.parse(body)
  const { id, actionDate, description, budgetAmount, budgetCurrency, proofUrl, proofR2Key } = parsed

  const updateData: Parameters<typeof updatePromoLogEntry>[2] = {}
  if (actionDate !== undefined) updateData.action_date = actionDate
  if (description !== undefined) updateData.description = description
  if (budgetAmount !== undefined) updateData.budget_amount = budgetAmount
  if (budgetCurrency !== undefined) updateData.budget_currency = budgetCurrency
  if (proofUrl !== undefined) updateData.proof_url = proofUrl
  if (proofR2Key !== undefined) updateData.proof_r2_key = proofR2Key

  const supabase = await createServerSupabaseClient()
  const entry = await updatePromoLogEntry(supabase, id, updateData)

  return NextResponse.json({ entry })
})
