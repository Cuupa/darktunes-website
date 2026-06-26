/**
 * Branded password-reset email via Resend.
 */

import type { SiteSettings } from '@/types'
import {
  buildCtaButtonHtml,
  buildImpressumFooterHtml,
  buildPlainUrlFallbackHtml,
  buildTransactionalEmailHtml,
} from '@/lib/email/buildTransactionalEmailLayout'

export interface SendPasswordResetEmailDeps {
  recipientEmail: string
  resetUrl: string
  settings: SiteSettings
  resendApiKey: string
  resendFromEmail: string
  siteUrl: string
  fetch: typeof globalThis.fetch
}

export const PASSWORD_RESET_EMAIL_SUBJECT = 'Reset your darkTunes password'

function buildPasswordResetBodyHtml(resetUrl: string): string {
  return `
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #ffffff;">Reset your password</h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
      We received a request to reset the password for your darkTunes account.
      Click the button below to choose a new password.
    </p>
    ${buildCtaButtonHtml('Reset password', resetUrl)}
    ${buildPlainUrlFallbackHtml(resetUrl)}
    <p style="margin: 24px 0 0; font-size: 12px; color: #666666; line-height: 1.6;">
      This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.
    </p>`
}

function buildPasswordResetText(resetUrl: string, settings: SiteSettings): string {
  const footerLines = [
    settings.impressumCompanyName,
    settings.impressumLegalForm,
    settings.impressumAddress,
    settings.impressumRepresentative ? `Represented by: ${settings.impressumRepresentative}` : '',
    settings.impressumPhone ? `Phone: ${settings.impressumPhone}` : '',
    settings.impressumEmail ? `Email: ${settings.impressumEmail}` : '',
    settings.impressumVatId ? `VAT ID: ${settings.impressumVatId}` : '',
  ].filter(Boolean)

  return `${settings.labelName} — Reset your password

We received a request to reset the password for your account.

Reset your password:
${resetUrl}

This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.

—
${footerLines.join('\n')}`
}

export async function sendPasswordResetEmail(
  deps: SendPasswordResetEmailDeps,
): Promise<{ success: boolean; error?: string }> {
  if (!deps.resendApiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  const siteUrl = deps.siteUrl.replace(/\/$/, '')
  const html = buildTransactionalEmailHtml({
    labelName: deps.settings.labelName,
    title: PASSWORD_RESET_EMAIL_SUBJECT,
    bodyHtml: buildPasswordResetBodyHtml(deps.resetUrl),
    footerHtml: buildImpressumFooterHtml(deps.settings, siteUrl),
  })
  const text = buildPasswordResetText(deps.resetUrl, deps.settings)

  let resendRes: Response
  try {
    resendRes = await deps.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deps.resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${deps.settings.labelName} <${deps.resendFromEmail}>`,
        to: [deps.recipientEmail],
        subject: PASSWORD_RESET_EMAIL_SUBJECT,
        html,
        text,
      }),
    })
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    console.error('[sendPasswordResetEmail] Resend fetch error:', msg)
    return { success: false, error: msg }
  }

  if (!resendRes.ok) {
    const errorText = await resendRes.text().catch(() => `HTTP ${resendRes.status}`)
    console.error(`[sendPasswordResetEmail] Resend error ${resendRes.status}:`, errorText)
    return { success: false, error: errorText }
  }

  return { success: true }
}