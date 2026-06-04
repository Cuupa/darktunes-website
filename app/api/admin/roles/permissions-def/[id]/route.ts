/**
 * app/api/admin/roles/permissions-def/[id]/route.ts
 *
 * PATCH  /api/admin/roles/permissions-def/:id  — Update label or description.
 * DELETE /api/admin/roles/permissions-def/:id  — Delete a custom permission definition.
 *
 * Security: admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

const patchSchema = z.object({
  label: z.string().min(1).max(256).optional(),
  description: z.string().max(512).nullable().optional(),
})

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const id = extractId(req)
  const body: unknown = await req.json()
  const updates = patchSchema.parse(body)

  const supabase = await createServerSupabaseClient()
  const { data: existing } = await supabase
    .from('custom_permission_definitions')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) throw new ApiError(404, 'Permission definition not found')

  const { data, error } = await supabase
    .from('custom_permission_definitions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  await supabase.from('rbac_audit_log').insert({
    actor_id: userId,
    action: 'custom_permission_updated',
    target_type: 'custom_permission',
    target_id: id,
    old_value: { label: existing.label, description: existing.description },
    new_value: updates,
  })

  return NextResponse.json(data)
})

export const DELETE = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const id = extractId(req)
  const supabase = await createServerSupabaseClient()

  const { data: existing } = await supabase
    .from('custom_permission_definitions')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) throw new ApiError(404, 'Permission definition not found')

  const { error } = await supabase
    .from('custom_permission_definitions')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)

  await supabase.from('rbac_audit_log').insert({
    actor_id: userId,
    action: 'custom_permission_deleted',
    target_type: 'custom_permission',
    target_id: id,
    old_value: { name: existing.name, label: existing.label },
  })

  return NextResponse.json({ success: true })
})
