/**
 * app/api/admin/roles/custom/route.ts
 *
 * GET  /api/admin/roles/custom  — List all custom roles with their permissions.
 * POST /api/admin/roles/custom  — Create a new custom role.
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
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Name must be lowercase alphanumeric with underscores'),
  label: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
  permissions: z.array(z.string().min(1).max(128)).optional(),
})

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const supabase = await createServerSupabaseClient()

  const { data: roles, error: rolesError } = await supabase
    .from('custom_roles')
    .select('*')
    .order('created_at', { ascending: true })

  if (rolesError) throw new Error(rolesError.message)

  const { data: perms, error: permsError } = await supabase
    .from('custom_role_permissions')
    .select('role_id, permission_name')

  if (permsError) throw new Error(permsError.message)

  const permsByRole: Record<string, string[]> = {}
  for (const p of perms ?? []) {
    ;(permsByRole[p.role_id] ??= []).push(p.permission_name)
  }

  const result = (roles ?? []).map((r) => ({
    ...r,
    permissions: permsByRole[r.id] ?? [],
  }))

  return NextResponse.json(result)
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const body: unknown = await req.json()
  const { name, label, description, permissions } = createSchema.parse(body)

  const supabase = await createServerSupabaseClient()

  // Create the custom role
  const { data: role, error: roleError } = await supabase
    .from('custom_roles')
    .insert({ name, label, description: description ?? null, created_by: userId })
    .select()
    .single()

  if (roleError) throw new Error(roleError.message)

  // Assign initial permissions if provided
  if (permissions && permissions.length > 0) {
    const { error: permError } = await supabase
      .from('custom_role_permissions')
      .insert(permissions.map((permission_name) => ({ role_id: role.id, permission_name })))

    if (permError) throw new Error(permError.message)
  }

  // Write RBAC audit entry
  await supabase.from('rbac_audit_log').insert({
    actor_id: userId,
    action: 'custom_role_created',
    target_type: 'custom_role',
    target_id: role.id,
    new_value: { name, label, description, permissions },
  })

  return NextResponse.json({ ...role, permissions: permissions ?? [] }, { status: 201 })
})
