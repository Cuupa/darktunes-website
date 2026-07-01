import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import {
  getReleaseTypeRules,
  upsertReleaseTypeRule,
} from '@/lib/api/submissionReleaseTypeRules'
import { SUBMISSION_RELEASE_TYPES, TRACK_COUNT_MODES } from '@/lib/submissions/fieldTypes'

const upsertSchema = z.object({
  id: z.string().optional(),
  release_type: z.enum(SUBMISSION_RELEASE_TYPES),
  track_count_mode: z.enum(TRACK_COUNT_MODES),
  min_tracks: z.number().int().min(1),
  max_tracks: z.number().int().min(1),
  display_order: z.number().int().optional(),
}).refine((data) => data.max_tracks >= data.min_tracks, {
  message: 'max_tracks must be >= min_tracks',
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const supabase = await createServiceRoleSupabaseClient()
  const rules = await getReleaseTypeRules(supabase)
  return NextResponse.json(rules)
})

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const supabase = await createServiceRoleSupabaseClient()

  const body = upsertSchema.parse(await req.json())
  const rule = await upsertReleaseTypeRule(supabase, {
    id: body.id,
    release_type: body.release_type,
    track_count_mode: body.track_count_mode,
    min_tracks: body.min_tracks,
    max_tracks: body.max_tracks,
    display_order: body.display_order,
  })
  return NextResponse.json(rule)
})