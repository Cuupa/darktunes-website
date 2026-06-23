/**
 * app/api/portal/checklist/route.ts
 *
 * PATCH /api/portal/checklist — toggle a release checklist item.
 *
 * Security:
 *   - Bearer token verified via Supabase Auth
 *   - RLS on release_checklists ensures artists can only update their own rows
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { toggleChecklistItem } from '@/lib/api/releaseChecklists'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const { supabase } = await authenticatePortalBearer(req)

  const body: unknown = await req.json()
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).checklistId !== 'string' ||
    typeof (body as Record<string, unknown>).isCompleted !== 'boolean'
  ) {
    throw new ApiError(400, 'Invalid payload: checklistId (string) and isCompleted (boolean) are required')
  }

  const { checklistId, isCompleted } = body as { checklistId: string; isCompleted: boolean }

  const result = await toggleChecklistItem(supabase, checklistId, isCompleted)
  return NextResponse.json(result)
})