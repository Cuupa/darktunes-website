import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { deletePortalFaqCategory, updatePortalFaqCategory } from '@/lib/api/portalFaq'

const patchSchema = z.object({
  slug: z.string().min(1).max(120).optional(),
  title_en: z.string().min(1).optional(),
  title_de: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_published: z.boolean().optional(),
})

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const supabase = await createServiceRoleSupabaseClient()
  const id = extractId(req)
  const body = patchSchema.parse(await req.json())
  const category = await updatePortalFaqCategory(supabase, id, body)
  return NextResponse.json(category)
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const supabase = await createServiceRoleSupabaseClient()
  const id = extractId(req)
  await deletePortalFaqCategory(supabase, id)
  return NextResponse.json({ deleted: true })
})