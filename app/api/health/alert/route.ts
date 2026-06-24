/**
 * app/api/health/alert/route.ts
 *
 * POST /api/health/alert
 *
 * Cron-only proactive alert dispatcher. Evaluates health, deduplicates
 * critical alerts, and sends email (Resend) + optional webhook.
 *
 * Auth: ****** or admin JWT.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { isValidCronSecret } from '@/lib/cronAuth'
import { processHealthAlerts } from '@/lib/health/alertNotifier'
import { buildHealthSnapshot } from '@/lib/health/healthSnapshot'
import { recordHealthHeartbeat } from '@/lib/health/heartbeats'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import {
  getEmailCredentials,
  getHealthAlertWebhookUrl,
} from '@/lib/secrets/getExternalCredentials'

export const maxDuration = 60

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  const isCronAuthorized = Boolean(cronSecret && isValidCronSecret(authHeader, cronSecret))

  if (!isCronAuthorized) {
    const token = extractBearerToken(authHeader)
    await verifyAdmin(token)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new ApiError(500, 'Supabase is not configured')
  }

  const db = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const [emailCredentials, healthAlertWebhookUrl] = await Promise.all([
    getEmailCredentials(db),
    getHealthAlertWebhookUrl(db),
  ])

  const snapshot = await buildHealthSnapshot({ db })
  const dispatch = await processHealthAlerts(snapshot, {
    db,
    fetch: globalThis.fetch,
    resendApiKey: emailCredentials.resendApiKey ?? undefined,
    resendFromEmail: emailCredentials.resendFromEmail ?? undefined,
    labelNotificationEmail: process.env.LABEL_NOTIFICATION_EMAIL,
    healthAlertWebhookUrl: healthAlertWebhookUrl ?? undefined,
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
