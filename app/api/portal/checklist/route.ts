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
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { toggleChecklistItem } from '@/lib/api/releaseChecklists'

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

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
