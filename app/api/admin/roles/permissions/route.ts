import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler } from '@/lib/errors'
import { extractBearerToken, verifyAdmin, verifyAdminOrEditor } from '@/lib/adminAuth'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const patchSchema = z.object({
  role: z.enum(['admin', 'editor', 'journalist', 'user', 'artist']),
  permissions: z.object({
    can_publish_news: z.boolean().optional(),
    can_edit_news: z.boolean().optional(),
    can_manage_artists: z.boolean().optional(),
    can_manage_releases: z.boolean().optional(),
    can_manage_videos: z.boolean().optional(),
    can_view_admin_panel: z.boolean().optional(),
  }),
})

/**
 * GET /api/admin/roles/permissions
 * Returns all rows from role_permissions, ordered by role.
 * Requires admin or editor role.
 */
export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('role_permissions')
    .select('*')
    .order('role')

  if (error) throw new Error(error.message)
  return NextResponse.json(data)
})

/**
 * PATCH /api/admin/roles/permissions
 * Updates permissions for a specific role. Admin only.
 * Body: { role: string, permissions: Partial<RolePermissions> }
 */
export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const body: unknown = await req.json()
  const { role, permissions } = patchSchema.parse(body)

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('role_permissions')
    .update({ ...permissions, updated_by: userId })
    .eq('role', role)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return NextResponse.json(data)
})
