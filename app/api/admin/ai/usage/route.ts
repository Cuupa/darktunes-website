/**
 * GET /api/admin/ai/usage
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { requireAdminWithServiceClient } from '@/lib/adminAuth'
import { startOfUtcDay, startOfUtcMonth } from '@/lib/ai/budget/limits'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { serviceClient } = await requireAdminWithServiceClient(req)
  const dayStart = startOfUtcDay().toISOString()
  const monthStart = startOfUtcMonth().toISOString()

  const [today, month, byModel] = await Promise.all([
    serviceClient
      .from('ai_usage_events')
      .select('total_tokens')
      .gte('created_at', dayStart),
    serviceClient
      .from('ai_usage_events')
      .select('total_tokens')
      .gte('created_at', monthStart),
    serviceClient
      .from('ai_usage_events')
      .select('model, total_tokens')
      .gte('created_at', monthStart),
  ])

  const sum = (rows: Array<{ total_tokens: number }> | null) =>
    (rows ?? []).reduce((acc, row) => acc + (row.total_tokens ?? 0), 0)

  const models: Record<string, number> = {}
  for (const row of byModel.data ?? []) {
    models[row.model] = (models[row.model] ?? 0) + row.total_tokens
  }

  return NextResponse.json({
    today_tokens: sum(today.data),
    month_tokens: sum(month.data),
    by_model: Object.entries(models).map(([model, total_tokens]) => ({ model, total_tokens })),
  })
})
