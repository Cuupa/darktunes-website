/**
 * app/api/admin/roles/permissions-def/route.ts
 *
 * GET  /api/admin/roles/permissions-def  — List all custom permission definitions.
 * POST /api/admin/roles/permissions-def  — Create a new custom permission definition.
 *
 * Security: admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const createSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(128)
    .regex(/^[a-z0-9_]+$/, 'Name must be lowercase alphanumeric with underscores'),
  label: z.string().min(1).max(256),
  description: z.string().max(512).optional(),
})

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('custom_permission_definitions')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return NextResponse.json(data ?? [])
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const body: unknown = await req.json()
  const { name, label, description } = createSchema.parse(body)

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('custom_permission_definitions')
    .insert({ name, label, description: description ?? null, created_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)

  await supabase.from('rbac_audit_log').insert({
    actor_id: userId,
    action: 'custom_permission_created',
    target_type: 'custom_permission',
    target_id: data.id,
    new_value: { name, label, description },
  })

  return NextResponse.json(data, { status: 201 })
})
