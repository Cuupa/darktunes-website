/**
 * app/api/health/alert/route.ts
 *
 * POST /api/health/alert
 *
 * Cron-only proactive alert dispatcher. Evaluates health, deduplicates
 * critical alerts, and sends email (Resend) + optional webhook.
 *
 * Auth: Bearer CRON_SECRET (Vercel cron must include Authorization header).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { isValidCronSecret } from '@/lib/cronAuth'
import { processHealthAlerts } from '@/lib/health/alertNotifier'
import { buildHealthSnapshot } from '@/lib/health/healthSnapshot'
import { recordHealthHeartbeat } from '@/lib/health/heartbeats'

export const maxDuration = 60

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const isCron = request.headers.get('x-vercel-cron') === '1'
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET

  if (isCron) {
    if (!cronSecret || !isValidCronSecret(authHeader, cronSecret)) {
      throw new ApiError(401, 'Unauthorized')
    }
  } else if (!cronSecret || !isValidCronSecret(authHeader, cronSecret)) {
    throw new ApiError(401, 'Unauthorized')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new ApiError(500, 'Supabase is not configured')
  }

  const db = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const snapshot = await buildHealthSnapshot({ db })
  const dispatch = await processHealthAlerts(snapshot, {
    db,
    fetch: globalThis.fetch,
    resendApiKey: process.env.RESEND_API_KEY,
    resendFromEmail: process.env.RESEND_FROM_EMAIL,
    labelNotificationEmail: process.env.LABEL_NOTIFICATION_EMAIL,
    healthAlertWebhookUrl: process.env.HEALTH_ALERT_WEBHOOK_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  })

  await recordHealthHeartbeat(db, 'health_alert')

  return NextResponse.json({
    ok: true,
    healthStatus: snapshot.status,
    healthScore: snapshot.healthScore,
    criticalAlerts: dispatch.criticalCount,
    dispatch,
  })
})

export const GET = POST