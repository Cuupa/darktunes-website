/**
 * app/api/admin/sos/presets/route.ts
 *
 * GET  /api/admin/sos/presets  — list all rule presets
 * POST /api/admin/sos/presets  — create a new preset
 */

import { NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (role !== 'admin') throw new ApiError(403, 'Forbidden')
  return supabase
}

export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  const supabase = await requireAdmin()
  const { data, error } = await supabase
    .from('sos_rules_presets')
    .select('id, name, config, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw new ApiError(500, error.message)
  return NextResponse.json({ presets: data ?? [] })
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await requireAdmin()
  const body = await req.json()
  const { name, config } = body as { name?: string; config?: Record<string, unknown> }
  if (!name?.trim()) throw new ApiError(400, 'name is required')
  if (!config || typeof config !== 'object') throw new ApiError(400, 'config must be an object')

  const { data, error } = await supabase
    .from('sos_rules_presets')
    .insert({ name: name.trim(), config })
    .select()
    .single()
  if (error) throw new ApiError(500, error.message)
  return NextResponse.json({ preset: data }, { status: 201 })
})
