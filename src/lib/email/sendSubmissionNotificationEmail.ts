/**
 * src/lib/email/sendSubmissionNotificationEmail.ts
 *
 * Email notification service for artist release and video submissions.
 *
 * When an artist submits a release or video through the portal, this function
 * sends a notification email to the label's notification address so staff can
 * review the submission promptly.
 *
 * The target address is read from the LABEL_NOTIFICATION_EMAIL environment
 * variable. If that variable is not set the email is silently skipped.
 *
 * This function is intentionally non-throwing: all errors are returned as
 * { success: false, error: '...' } so callers can safely fire-and-forget.
 */

export type SubmissionType = 'release' | 'video'

export interface SubmissionDetails {
  type: SubmissionType
  title: string
  artistName: string
  submittedAt: string
  /** Absolute URL to the admin tab that shows the submission */
  adminUrl: string
}

export interface SendSubmissionEmailDeps {
  resendApiKey: string
  resendFromEmail: string
  labelNotificationEmail: string
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

function buildSubject(details: SubmissionDetails): string {
  const typeLabel = details.type === 'release' ? 'Release' : 'Video'
  return `New ${typeLabel} Submission: ${details.title}`
}

function buildEmailHtml(details: SubmissionDetails): string {
  const typeLabel = details.type === 'release' ? 'Release' : 'Video'
  const tabParam = details.type === 'release' ? 'release-submissions' : 'video-submissions'
  const reviewUrl = `${details.adminUrl}?tab=${tabParam}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New ${escapeHtml(typeLabel)} Submission</title>
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
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #ffffff;">
                New ${escapeHtml(typeLabel)} Submission
              </h1>
              <p style="margin: 0 0 24px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
                An artist has submitted a new ${escapeHtml(typeLabel.toLowerCase())} for review.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background-color: #242424; border-radius: 6px; padding: 16px; width: 100%;">
                <tr><td>
                  <p style="margin: 0 0 8px; font-size: 14px; color: #9a9a9a; text-transform: uppercase; letter-spacing: 0.08em;">Submission Details</p>
                  <p style="margin: 0 0 8px;">Title: <strong>${escapeHtml(details.title)}</strong></p>
                  <p style="margin: 0 0 8px;">Artist: <strong>${escapeHtml(details.artistName)}</strong></p>
                  <p style="margin: 0; font-size: 13px; color: #b0b0b0;">Submitted: ${escapeHtml(details.submittedAt)}</p>
                </td></tr>
              </table>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius: 6px; background-color: #493687;">
                    <a href="${reviewUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #493687;">
                      Review Submission
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #2a2a2a;">
              <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.6;">
                You are receiving this email because a new artist submission requires review at darkTunes Music Group.
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

export async function sendSubmissionNotificationEmail(
  details: SubmissionDetails,
  deps: SendSubmissionEmailDeps,
): Promise<{ success: boolean; error?: string }> {
  if (!deps.resendApiKey) {
    console.warn('[sendSubmissionNotificationEmail] RESEND_API_KEY is not configured — skipping email')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  if (!deps.labelNotificationEmail) {
    console.warn('[sendSubmissionNotificationEmail] LABEL_NOTIFICATION_EMAIL is not configured — skipping email')
    return { success: false, error: 'LABEL_NOTIFICATION_EMAIL not configured' }
  }

  const html = buildEmailHtml(details)
  const subject = buildSubject(details)

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
        to: [deps.labelNotificationEmail],
        subject,
        html,
      }),
    })
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    console.error('[sendSubmissionNotificationEmail] Resend fetch error:', msg)
    return { success: false, error: msg }
  }

  if (!resendRes.ok) {
    const errorText = await resendRes.text().catch(() => `HTTP ${resendRes.status}`)
    console.error(`[sendSubmissionNotificationEmail] Resend error ${resendRes.status}:`, errorText)
    return { success: false, error: errorText }
  }

  return { success: true }
}
