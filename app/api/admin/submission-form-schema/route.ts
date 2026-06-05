import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { getAllFormSchemaFields, upsertFormField } from '@/lib/api/submissionFormSchema'

const upsertSchema = z.object({
  id: z.string().optional(),
  form_type: z.enum(['release', 'video']),
  field_key: z.string().min(1),
  field_label_en: z.string().min(1),
  field_label_de: z.string().min(1),
  field_type: z.enum(['text', 'url', 'date', 'select', 'textarea', 'boolean']),
  field_options: z.record(z.string(), z.unknown()).nullable().optional(),
  is_required: z.boolean().optional(),
  is_visible: z.boolean().optional(),
  display_order: z.number().optional(),
  placeholder_en: z.string().nullable().optional(),
  placeholder_de: z.string().nullable().optional(),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const supabase = await createServerSupabaseClient()

  const formType = req.nextUrl.searchParams.get('type')
  if (formType !== 'release' && formType !== 'video') {
    throw new ApiError(400, 'type must be "release" or "video"')
  }

  const fields = await getAllFormSchemaFields(supabase, formType)
  return NextResponse.json(fields)
})

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const supabase = await createServerSupabaseClient()

  const body = upsertSchema.parse(await req.json())
  const field = await upsertFormField(supabase, body)
  return NextResponse.json(field)
})
