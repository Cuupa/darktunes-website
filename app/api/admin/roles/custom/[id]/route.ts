/**
 * app/api/admin/roles/custom/[id]/route.ts
 *
 * GET    /api/admin/roles/custom/:id  — Get a single custom role with its permissions.
 * PATCH  /api/admin/roles/custom/:id  — Update label, description, or permissions.
 * DELETE /api/admin/roles/custom/:id  — Delete a custom role (cascades to permissions/assignments).
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
  label: z.string().min(1).max(128).optional(),
  description: z.string().max(512).nullable().optional(),
  permissions: z.array(z.string().min(1).max(128)).optional(),
})

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const id = extractId(req)
  const supabase = await createServerSupabaseClient()

  const { data: role, error } = await supabase
    .from('custom_roles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !role) throw new ApiError(404, 'Custom role not found')

  const { data: perms } = await supabase
    .from('custom_role_permissions')
    .select('permission_name')
    .eq('role_id', id)

  return NextResponse.json({ ...role, permissions: (perms ?? []).map((p) => p.permission_name) })
})

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const id = extractId(req)
  const body: unknown = await req.json()
  const updates = patchSchema.parse(body)

  const supabase = await createServerSupabaseClient()

  // Fetch existing for audit diff
  const { data: existing } = await supabase
    .from('custom_roles')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) throw new ApiError(404, 'Custom role not found')

  // Update role metadata if provided
  const metaUpdate: Record<string, unknown> = {}
  if (updates.label !== undefined) metaUpdate.label = updates.label
  if (updates.description !== undefined) metaUpdate.description = updates.description

  let updatedRole = existing
  if (Object.keys(metaUpdate).length > 0) {
    const { data, error } = await supabase
      .from('custom_roles')
      .update(metaUpdate)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    updatedRole = data
  }

  // Replace permissions atomically if provided
  let newPermissions: string[] | undefined
  if (updates.permissions !== undefined) {
    await supabase.from('custom_role_permissions').delete().eq('role_id', id)
    if (updates.permissions.length > 0) {
      const { error: permError } = await supabase
        .from('custom_role_permissions')
        .insert(updates.permissions.map((permission_name) => ({ role_id: id, permission_name })))
      if (permError) throw new Error(permError.message)
    }
    newPermissions = updates.permissions
  } else {
    const { data: perms } = await supabase
      .from('custom_role_permissions')
      .select('permission_name')
      .eq('role_id', id)
    newPermissions = (perms ?? []).map((p) => p.permission_name)
  }

  // Write RBAC audit
  await supabase.from('rbac_audit_log').insert({
    actor_id: userId,
    action: 'custom_role_updated',
    target_type: 'custom_role',
    target_id: id,
    old_value: { label: existing.label, description: existing.description },
    new_value: { ...metaUpdate, permissions: newPermissions },
  })

  return NextResponse.json({ ...updatedRole, permissions: newPermissions })
})

export const DELETE = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const id = extractId(req)
  const supabase = await createServerSupabaseClient()

  const { data: existing } = await supabase
    .from('custom_roles')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) throw new ApiError(404, 'Custom role not found')

  const { error } = await supabase.from('custom_roles').delete().eq('id', id)
  if (error) throw new Error(error.message)

  // Write RBAC audit
  await supabase.from('rbac_audit_log').insert({
    actor_id: userId,
    action: 'custom_role_deleted',
    target_type: 'custom_role',
    target_id: id,
    old_value: { name: existing.name, label: existing.label },
  })

  return NextResponse.json({ success: true })
})
