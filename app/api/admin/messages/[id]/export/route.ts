/**
 * GET /api/admin/messages/[id]/export
 * Compliance export: portal message + internal notes + audit events as JSON.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { exportPortalMessageBundle } from '@/lib/api/messageOps'

function extractId(req: NextRequest): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean)
  const idx = parts.indexOf('messages')
  return parts[idx + 1] ?? ''
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)
  const messageId = extractId(req)
  if (!messageId) throw new ApiError(400, 'Missing message id')

  const supabase = await createServerSupabaseClient()
  try {
    const bundle = await exportPortalMessageBundle(supabase, messageId, userId)
    return NextResponse.json(bundle, {
      headers: {
        'Content-Disposition': `attachment; filename="message-${messageId}.json"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Export failed'
    if (msg === 'Message not found') throw new ApiError(404, msg)
    throw new ApiError(500, msg)
  }
})
