/**
 * GET  /api/admin/sos/presets  — list all rule presets
 * POST /api/admin/sos/presets  — create or update a preset by name
 */

import { requireAdminFromRequest } from '@/lib/adminAuth'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  listRulesPresets,
  upsertRulesPresetByName,
  type RulesPresetConfig,
} from '@/lib/api/sosRulesPresets'
import { normalizeAccountingConfig } from '@/lib/sos/sosAccountingSettings'
import { ApiError, withErrorHandler } from '@/lib/errors'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminFromRequest(req)
  const serviceSupabase = await createServiceRoleSupabaseClient()
  const presets = await listRulesPresets(serviceSupabase)
  return NextResponse.json({
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      config: p.config,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    })),
  })
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminFromRequest(req)
  const body = await req.json()
  const { name, config } = body as { name?: string; config?: Partial<RulesPresetConfig> }
  if (!name?.trim()) throw new ApiError(400, 'name is required')
  if (!config || typeof config !== 'object') throw new ApiError(400, 'config must be an object')

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const preset = await upsertRulesPresetByName(serviceSupabase, {
    name: name.trim(),
    config: normalizeAccountingConfig(config),
  })

  return NextResponse.json({
    preset: {
      id: preset.id,
      name: preset.name,
      config: preset.config,
      created_at: preset.createdAt,
      updated_at: preset.updatedAt,
    },
  }, { status: 200 })
})