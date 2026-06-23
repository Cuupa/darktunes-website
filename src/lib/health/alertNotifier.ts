/**
 * src/lib/health/alertNotifier.ts
 *
 * Dispatches proactive critical health alerts with cooldown deduplication.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { sendHealthAlertNotification } from '@/lib/email/sendHealthAlertNotification'
import {
  getHealthAlertDispatchState,
  markHealthAlertsDispatched,
  shouldDispatchCriticalAlerts,
} from './alertCooldown'
import { buildCriticalAlertFingerprint } from './alerts'
import { HEALTH_ALERT_COOLDOWN_MS } from './thresholds'
import type { HealthAlertDispatchResult, HealthResponse } from './types'

export interface ProcessHealthAlertsDeps {
  db: SupabaseClient<Database>
  fetch: typeof globalThis.fetch
  resendApiKey?: string
  resendFromEmail?: string
  labelNotificationEmail?: string
  healthAlertWebhookUrl?: string
  siteUrl?: string
  cooldownMs?: number
}

async function postWebhook(
  url: string,
  snapshot: HealthResponse,
  criticalAlerts: HealthResponse['alerts'],
  fetchFn: typeof globalThis.fetch,
): Promise<boolean> {
  const text = `darkTunes critical health: ${criticalAlerts.length} alert(s) — score ${snapshot.healthScore}/100 — ${snapshot.statusLabel}`
  const payload = {
    text,
    snapshot: {
      status: snapshot.status,
      statusLabel: snapshot.statusLabel,
      healthScore: snapshot.healthScore,
      checkedAt: snapshot.checkedAt,
    },
    alerts: criticalAlerts.map((a) => ({
      id: a.id,
      title: a.title,
      message: a.message,
      source: a.source,
    })),
  }

  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch (err) {
    console.error('[alertNotifier] webhook failed:', err)
    return false
  }
}

export async function processHealthAlerts(
  snapshot: HealthResponse,
  deps: ProcessHealthAlertsDeps,
): Promise<HealthAlertDispatchResult> {
  const criticalAlerts = snapshot.alerts.filter((a) => a.severity === 'critical')
  const fingerprint = buildCriticalAlertFingerprint(snapshot.alerts)
  const cooldownMs = deps.cooldownMs ?? HEALTH_ALERT_COOLDOWN_MS

  const state = await getHealthAlertDispatchState(deps.db)
  const gate = shouldDispatchCriticalAlerts(state, fingerprint, cooldownMs)

  if (!gate.dispatch) {
    return {
      sent: false,
      skipped: true,
      skipReason: gate.reason,
      fingerprint,
      criticalCount: criticalAlerts.length,
      channels: { email: false, webhook: false },
    }
  }

  let emailSent = false
  let webhookSent = false

  if (deps.resendApiKey && deps.labelNotificationEmail && deps.resendFromEmail) {
    const emailResult = await sendHealthAlertNotification(snapshot, criticalAlerts, {
      resendApiKey: deps.resendApiKey,
      resendFromEmail: deps.resendFromEmail,
      labelNotificationEmail: deps.labelNotificationEmail,
      siteUrl: deps.siteUrl ?? 'https://darktunes.com',
      fetch: deps.fetch,
    })
    emailSent = emailResult.success
    if (!emailResult.success && emailResult.error !== 'no_critical_alerts') {
      console.error('[alertNotifier] email failed:', emailResult.error)
    }
  }

  if (deps.healthAlertWebhookUrl) {
    webhookSent = await postWebhook(
      deps.healthAlertWebhookUrl,
      snapshot,
      criticalAlerts,
      deps.fetch,
    )
  }

  const sent = emailSent || webhookSent
  if (sent) {
    await markHealthAlertsDispatched(deps.db, fingerprint)
  }

  return {
    sent,
    skipped: !sent,
    skipReason: sent ? null : 'no_notification_channels_configured',
    fingerprint,
    criticalCount: criticalAlerts.length,
    channels: { email: emailSent, webhook: webhookSent },
  }
}