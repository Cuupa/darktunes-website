/**
 * GET /api/admin/sos/presets/default — ensure and return the Default preset
 * PUT /api/admin/sos/presets/default — save settings to the Default preset
 */

import { NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  ensureDefaultRulesPreset,
  upsertRulesPresetByName,
  type RulesPresetConfig,
} from '@/lib/api/sosRulesPresets'
import { DEFAULT_PRESET_NAME, normalizeAccountingConfig } from '@/lib/sos/sosAccountingSettings'
import { ApiError, withErrorHandler } from '@/lib/errors'

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (role !== 'admin') throw new ApiError(403, 'Forbidden')
  return supabase
}

function presetResponse(preset: Awaited<ReturnType<typeof ensureDefaultRulesPreset>>) {
  return {
    preset: {
      id: preset.id,
      name: preset.name,
      config: preset.config,
      created_at: preset.createdAt,
      updated_at: preset.updatedAt,
    },
  }
}

export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  await requireAdmin()
  const serviceSupabase = await createServiceRoleSupabaseClient()
  const preset = await ensureDefaultRulesPreset(serviceSupabase)
  return NextResponse.json(presetResponse(preset))
})

export const PUT = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdmin()
  const body = await req.json()
  const { config } = body as { config?: Partial<RulesPresetConfig> }
  if (!config || typeof config !== 'object') throw new ApiError(400, 'config must be an object')

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const preset = await upsertRulesPresetByName(serviceSupabase, {
    name: DEFAULT_PRESET_NAME,
    config: normalizeAccountingConfig(config),
  })

  return NextResponse.json(presetResponse(preset))
})