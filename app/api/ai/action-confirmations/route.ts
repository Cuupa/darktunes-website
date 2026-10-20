/**
 * POST /api/ai/action-confirmations
 * Confirm a prepared assistant write after a second authz check.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, buildApiError, withErrorHandler } from '@/lib/errors'
import { requireAiActor } from '@/lib/ai/auth/requireAiActor'
import { consumeActionConfirmation } from '@/lib/ai/actions/confirmations'
import { executeConfirmedAction } from '@/lib/ai/actions/executeConfirmed'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'

const bodySchema = z.object({
  confirmation_token: z.string().min(16).max(200),
  action: z.enum([
    'save_epk_text',
    'save_profile_update',
    'save_release_draft',
    'create_support_ticket',
    'save_error_report',
  ]),
  artist_id: z.string().uuid().nullable().optional(),
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) throw new ApiError(400, 'Invalid confirmation payload', 'VALIDATION_ERROR')

  const actor = await requireAiActor(req, {
    artistId: parsed.data.artist_id,
    requireArtist: Boolean(parsed.data.artist_id),
  })
  const limited = await checkDistributedRateLimit(`ai-confirm:${actor.userId}`, 20, 10 * 60 * 1000)
  if (limited.limited) throw buildApiError('RATE_LIMITED', 429)

  const payload = await consumeActionConfirmation(actor.serviceDb, {
    actor,
    token: parsed.data.confirmation_token,
    action: parsed.data.action,
  })
  const result = await executeConfirmedAction(actor, parsed.data.action, payload)
  return NextResponse.json({ ok: result.ok, detail: result.detail })
})
