/**
 * app/api/admin/sos/presets/[id]/route.ts
 *
 * PUT    /api/admin/sos/presets/:id  — update a preset (name and/or config)
 * DELETE /api/admin/sos/presets/:id  — delete a preset
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') throw new ApiError(403, 'Forbidden')
  return supabase
}

export const PUT = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await requireAdmin()
  const id = new URL(req.url).pathname.split('/').at(-1) ?? ''
  if (!id) throw new ApiError(400, 'Missing preset id')
  const body = await req.json()
  const { name, config } = body as { name?: string; config?: unknown }
  const update: { name?: string; config?: Record<string, unknown> } = {}
  if (name !== undefined) update.name = name.trim()
  if (config !== undefined) update.config = config as Record<string, unknown>
  if (Object.keys(update).length === 0) throw new ApiError(400, 'Nothing to update')

  const { data, error } = await supabase
    .from('sos_rules_presets')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new ApiError(500, error.message)
  return NextResponse.json({ preset: data })
})

export const DELETE = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await requireAdmin()
  const id = new URL(req.url).pathname.split('/').at(-1) ?? ''
  if (!id) throw new ApiError(400, 'Missing preset id')
  const { error } = await supabase.from('sos_rules_presets').delete().eq('id', id)
  if (error) throw new ApiError(500, error.message)
  return NextResponse.json({ ok: true })
})
