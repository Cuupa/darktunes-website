/**
 * src/lib/email/sendHealthAlertNotification.ts
 *
 * Sends a bundled critical health alert email to label staff via Resend.
 * Non-throwing — safe for cron fire-and-forget usage.
 */

import type { HealthAlert, HealthResponse } from '@/lib/health/types'

export interface SendHealthAlertEmailDeps {
  resendApiKey: string
  resendFromEmail: string
  labelNotificationEmail: string
  siteUrl: string
  fetch: typeof globalThis.fetch
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function buildSubject(snapshot: HealthResponse, criticalCount: number): string {
  return `[darkTunes] ${criticalCount} critical health alert${criticalCount === 1 ? '' : 's'} — score ${snapshot.healthScore}/100`
}

function buildEmailHtml(
  snapshot: HealthResponse,
  criticalAlerts: HealthAlert[],
  adminUrl: string,
): string {
  const alertRows = criticalAlerts
    .map(
      (alert) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #2a2a2a;">
            <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #ff6b6b;">${escapeHtml(alert.title)}</p>
            <p style="margin: 0; font-size: 13px; color: #b0b0b0; line-height: 1.5;">${escapeHtml(alert.message)}</p>
          </td>
        </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Health Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0e0e0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0e0e0e; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #1a1a1a; border-radius: 8px; overflow: hidden; border: 1px solid #2a2a2a;">
          <tr>
            <td style="background-color: #7e1e37; padding: 24px 32px;">
              <p style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">darkTunes — Health Alert</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #b0b0b0;">System status</p>
              <p style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #ffffff;">${escapeHtml(snapshot.statusLabel)} · ${snapshot.healthScore}/100</p>
              <p style="margin: 0 0 24px; font-size: 14px; color: #b0b0b0; line-height: 1.6;">${escapeHtml(snapshot.statusDetail)}</p>
              <table width="100%" cellpadding="0" cellspacing="0">${alertRows}</table>
              <p style="margin: 24px 0 0;">
                <a href="${escapeHtml(adminUrl)}" style="display: inline-block; background-color: #493687; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600; font-size: 14px;">Open Admin Health Dashboard</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendHealthAlertNotification(
  snapshot: HealthResponse,
  criticalAlerts: HealthAlert[],
  deps: SendHealthAlertEmailDeps,
): Promise<{ success: boolean; error?: string }> {
  if (!deps.resendApiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }
  if (!deps.labelNotificationEmail) {
    return { success: false, error: 'LABEL_NOTIFICATION_EMAIL not configured' }
  }
  if (!deps.resendFromEmail) {
    return { success: false, error: 'RESEND_FROM_EMAIL not configured' }
  }
  if (criticalAlerts.length === 0) {
    return { success: false, error: 'no_critical_alerts' }
  }

  const adminUrl = `${deps.siteUrl.replace(/\/$/, '')}/admin/system`
  const subject = buildSubject(snapshot, criticalAlerts.length)
  const html = buildEmailHtml(snapshot, criticalAlerts, adminUrl)

  try {
    const response = await deps.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deps.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: deps.resendFromEmail,
        to: [deps.labelNotificationEmail],
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      return { success: false, error: `Resend error ${response.status}: ${body.slice(0, 200)}` }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}