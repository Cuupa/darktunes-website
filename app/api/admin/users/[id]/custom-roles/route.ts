/**
 * GET  /api/admin/users/:id/custom-roles — list assigned custom roles
 * PUT  /api/admin/users/:id/custom-roles — replace assigned custom roles
 *
 * Security: admin only (Bearer).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
const putSchema = z.object({
  roleIds: z.array(z.string().uuid()),
})

function extractUserId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean)
  // .../users/:id/custom-roles
  const usersIdx = segments.indexOf('users')
  const id = usersIdx >= 0 ? segments[usersIdx + 1] : null
  if (!id) throw new ApiError(400, 'Missing user id')
  return id
}

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const userId = extractUserId(req)
  const supabase = await createServiceRoleSupabaseClient()

  const { data: assignments, error } = await supabase
    .from('user_custom_roles')
    .select('role_id, assigned_at, assigned_by')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  const roleIds = (assignments ?? []).map((row) => row.role_id)
  const metaById = new Map<string, { name: string; label: string; description: string | null }>()

  if (roleIds.length > 0) {
    const { data: meta, error: metaErr } = await supabase
      .from('custom_roles')
      .select('id, name, label, description')
      .in('id', roleIds)
    if (metaErr) throw new Error(metaErr.message)
    for (const row of meta ?? []) {
      metaById.set(row.id, {
        name: row.name,
        label: row.label,
        description: row.description,
      })
    }
  }

  const roles = (assignments ?? []).map((row) => {
    const cr = metaById.get(row.role_id)
    return {
      roleId: row.role_id,
      assignedAt: row.assigned_at,
      assignedBy: row.assigned_by,
      name: cr?.name ?? null,
      label: cr?.label ?? null,
      description: cr?.description ?? null,
    }
  })

  return NextResponse.json({ roles })
})

export const PUT = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const actorId = await verifyAdmin(token)

  const userId = extractUserId(req)
  if (userId === actorId) {
    throw new ApiError(403, 'You cannot modify your own custom roles')
  }

  const body: unknown = await req.json()
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((i) => i.message).join('; '), 'VALIDATION_ERROR')
  }

  const { roleIds } = parsed.data
  const uniqueRoleIds = [...new Set(roleIds)]
  const supabase = await createServiceRoleSupabaseClient()

  // Validate all role ids exist
  if (uniqueRoleIds.length > 0) {
    const { data: existing, error: existErr } = await supabase
      .from('custom_roles')
      .select('id')
      .in('id', uniqueRoleIds)
    if (existErr) throw new Error(existErr.message)
    const found = new Set((existing ?? []).map((r) => r.id))
    const missing = uniqueRoleIds.filter((id) => !found.has(id))
    if (missing.length > 0) {
      throw new ApiError(400, `Unknown custom role id(s): ${missing.join(', ')}`, 'VALIDATION_ERROR')
    }
  }

  const { data: previous, error: prevErr } = await supabase
    .from('user_custom_roles')
    .select('role_id')
    .eq('user_id', userId)
  if (prevErr) throw new Error(prevErr.message)

  const previousIds = (previous ?? []).map((r) => r.role_id).sort()
  const nextIds = [...uniqueRoleIds].sort()

  const { error: delErr } = await supabase.from('user_custom_roles').delete().eq('user_id', userId)
  if (delErr) throw new Error(delErr.message)

  if (uniqueRoleIds.length > 0) {
    const { error: insErr } = await supabase.from('user_custom_roles').insert(
      uniqueRoleIds.map((role_id) => ({
        user_id: userId,
        role_id,
        assigned_by: actorId,
      })),
    )
    if (insErr) throw new Error(insErr.message)
  }

  await supabase.from('rbac_audit_log').insert({
    actor_id: actorId,
    action: 'user_custom_roles_updated',
    target_type: 'user_custom_role',
    target_id: userId,
    old_value: { roleIds: previousIds },
    new_value: { roleIds: nextIds },
  })

  return NextResponse.json({ roleIds: nextIds })
})
