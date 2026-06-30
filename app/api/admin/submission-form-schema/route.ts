import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { getAllFormSchemaFields, upsertFormField } from '@/lib/api/submissionFormSchema'
import { SUBMISSION_FIELD_TYPES, SUBMISSION_FIELD_SCOPES } from '@/lib/submissions/fieldTypes'

const visibilitySchema = z.object({
  field: z.string().min(1),
  op: z.enum(['eq', 'neq', 'in']),
  value: z.union([z.string(), z.array(z.string())]),
})

const upsertSchema = z.object({
  id: z.string().optional(),
  form_type: z.enum(['release', 'video']),
  field_key: z.string().min(1),
  field_label_en: z.string().min(1),
  field_label_de: z.string().min(1),
  field_type: z.enum(SUBMISSION_FIELD_TYPES),
  field_scope: z.enum(SUBMISSION_FIELD_SCOPES).optional(),
  field_group: z.string().nullable().optional(),
  field_options: z.record(z.string(), z.unknown()).nullable().optional(),
  visibility_condition: visibilitySchema.nullable().optional(),
  validation: z.record(z.string(), z.unknown()).nullable().optional(),
  is_required: z.boolean().optional(),
  is_visible: z.boolean().optional(),
  display_order: z.number().optional(),
  placeholder_en: z.string().nullable().optional(),
  placeholder_de: z.string().nullable().optional(),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const supabase = await createServiceRoleSupabaseClient()

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
  const supabase = await createServiceRoleSupabaseClient()

  const body = upsertSchema.parse(await req.json())
  const field = await upsertFormField(supabase, {
    ...body,
    field_scope: body.field_scope ?? 'release',
    field_group: body.field_group ?? null,
    field_options: body.field_options ?? null,
    visibility_condition: body.visibility_condition ?? null,
    validation: body.validation ?? null,
    placeholder_en: body.placeholder_en ?? null,
    placeholder_de: body.placeholder_de ?? null,
  })
  return NextResponse.json(field)
})