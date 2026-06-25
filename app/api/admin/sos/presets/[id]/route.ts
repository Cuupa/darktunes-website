/**
 * PUT    /api/admin/sos/presets/:id  — update a preset (name and/or config)
 * DELETE /api/admin/sos/presets/:id  — delete a preset
 */

import { NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  deleteRulesPreset,
  updateRulesPreset,
  type RulesPresetConfig,
} from '@/lib/api/sosRulesPresets'
import { normalizeAccountingConfig } from '@/lib/sos/sosAccountingSettings'
import { ApiError, withErrorHandler } from '@/lib/errors'

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (role !== 'admin') throw new ApiError(403, 'Forbidden')
  return supabase
}

export const PUT = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdmin()
  const id = new URL(req.url).pathname.split('/').at(-1) ?? ''
  if (!id) throw new ApiError(400, 'Missing preset id')
  const body = await req.json()
  const { name, config } = body as { name?: string; config?: Partial<RulesPresetConfig> }

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const preset = await updateRulesPreset(serviceSupabase, id, {
    name,
    config: config ? normalizeAccountingConfig(config) : undefined,
  })

  return NextResponse.json({
    preset: {
      id: preset.id,
      name: preset.name,
      config: preset.config,
      created_at: preset.createdAt,
      updated_at: preset.updatedAt,
    },
  })
})

export const DELETE = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdmin()
  const id = new URL(req.url).pathname.split('/').at(-1) ?? ''
  if (!id) throw new ApiError(400, 'Missing preset id')

  const serviceSupabase = await createServiceRoleSupabaseClient()
  await deleteRulesPreset(serviceSupabase, id)
  return NextResponse.json({ ok: true })
})