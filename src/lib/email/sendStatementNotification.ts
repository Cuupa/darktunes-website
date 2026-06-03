/**
 * src/lib/email/sendStatementNotification.ts
 *
 * Email notification service for Statement-of-Sales uploads.
 *
 * Sends an email to the artist when a new royalty statement is available
 * in their portal. Uses the Resend API (same integration as contact form).
 *
 * This function is intentionally non-throwing: all errors are returned as
 * { success: false, error: '...' } so callers can safely fire-and-forget.
 */

import type { Artist } from '@/types'

export interface SendStatementEmailDeps {
  resendApiKey: string
  resendFromEmail: string
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

function buildEmailHtml(
  artistName: string,
  period: string,
  amountEur: number | undefined,
  statementsUrl: string,
  filename: string,
): string {
  const amountLine =
    amountEur !== undefined
      ? `<p style="margin: 0 0 8px;">Amount: <strong>&#x20AC;${amountEur.toFixed(2)}</strong></p>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Statement of Sales Available</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0e0e0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0e0e0e; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #1a1a1a; border-radius: 8px; overflow: hidden; border: 1px solid #2a2a2a;">
          <tr>
            <td style="background-color: #493687; padding: 24px 32px;">
              <p style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">darkTunes</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #ffffff;">New Statement of Sales Available</h1>
              <p style="margin: 0 0 24px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">Hi ${escapeHtml(artistName)},</p>
              <p style="margin: 0 0 24px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
                A new royalty statement has been uploaded for you. You can review and download it from your artist portal.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background-color: #242424; border-radius: 6px; padding: 16px; width: 100%;">
                <tr><td>
                  <p style="margin: 0 0 8px; font-size: 14px; color: #9a9a9a; text-transform: uppercase; letter-spacing: 0.08em;">Statement Details</p>
                  <p style="margin: 0 0 8px;">Period: <strong>${escapeHtml(period)}</strong></p>
                  ${amountLine}
                  <p style="margin: 0; font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #b0b0b0;">${escapeHtml(filename)}</p>
                </td></tr>
              </table>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius: 6px; background-color: #493687;">
                    <a href="${statementsUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #493687;">
                      View Statement in Portal
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #2a2a2a;">
              <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.6;">
                You are receiving this email because you are a registered artist with darkTunes Music Group.<br />
                If you have any questions, contact your label representative.
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

export async function sendStatementNotification(
  artist: Artist,
  statement: {
    filename: string
    period: string
    amountEur: number | undefined
  },
  deps: SendStatementEmailDeps,
): Promise<{ success: boolean; error?: string }> {
  if (!deps.resendApiKey) {
    console.warn('[sendStatementNotification] RESEND_API_KEY is not configured — skipping email')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  if (!artist.email) {
    return { success: false, error: `Artist "${artist.name}" has no email address` }
  }

  const siteUrl = deps.siteUrl.replace(/\/$/, '')
  const statementsUrl = `${siteUrl}/portal/statements`
  const html = buildEmailHtml(
    artist.name,
    statement.period,
    statement.amountEur,
    statementsUrl,
    statement.filename,
  )

  let resendRes: Response
  try {
    resendRes = await deps.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deps.resendApiKey}`,
      },
      body: JSON.stringify({
        from: `darkTunes <${deps.resendFromEmail}>`,
        to: [artist.email],
        subject: `New Statement of Sales Available – ${statement.period}`,
        html,
      }),
    })
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    console.error('[sendStatementNotification] Resend fetch error:', msg)
    return { success: false, error: msg }
  }

  if (!resendRes.ok) {
    const errorText = await resendRes.text().catch(() => `HTTP ${resendRes.status}`)
    console.error(`[sendStatementNotification] Resend error ${resendRes.status}:`, errorText)
    return { success: false, error: errorText }
  }

  return { success: true }
}
