/**
 * Branded user-invite email via Resend.
 */

import type { SiteSettings } from '@/types'
import type { UserRole } from '@/types/users'
import {
  buildCtaButtonHtml,
  buildImpressumFooterHtml,
  buildPlainUrlFallbackHtml,
  buildTransactionalEmailHtml,
} from '@/lib/email/buildTransactionalEmailLayout'

export interface SendInviteEmailDeps {
  recipientEmail: string
  inviteUrl: string
  settings: SiteSettings
  resendApiKey: string
  resendFromEmail: string
  siteUrl: string
  role: UserRole
  fetch: typeof globalThis.fetch
}

export const INVITE_EMAIL_SUBJECT = 'You have been invited to darkTunes'

function roleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Administrator'
    case 'editor':
      return 'Editor'
    case 'journalist':
      return 'Journalist'
    case 'artist':
      return 'Artist'
    default:
      return 'User'
  }
}

function buildInviteBodyHtml(inviteUrl: string, role: UserRole, labelName: string): string {
  const roleText = roleLabel(role)
  const accountHint =
    role === 'artist'
      ? 'You will set a password and complete your artist profile.'
      : 'You will set a password to activate your account.'

  return `
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #ffffff;">Welcome to ${labelName}</h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
      You have been invited to join ${labelName} as <strong style="color: #ffffff;">${roleText}</strong>.
      ${accountHint}
    </p>
    ${buildCtaButtonHtml('Accept invitation', inviteUrl)}
    ${buildPlainUrlFallbackHtml(inviteUrl)}
    <p style="margin: 24px 0 0; font-size: 12px; color: #666666; line-height: 1.6;">
      This link expires after a limited time. If you did not expect this invitation, you can safely ignore this email.
    </p>`
}

function buildInviteText(inviteUrl: string, role: UserRole, settings: SiteSettings): string {
  const footerLines = [
    settings.impressumCompanyName,
    settings.impressumLegalForm,
    settings.impressumAddress,
    settings.impressumRepresentative ? `Represented by: ${settings.impressumRepresentative}` : '',
    settings.impressumPhone ? `Phone: ${settings.impressumPhone}` : '',
    settings.impressumEmail ? `Email: ${settings.impressumEmail}` : '',
    settings.impressumVatId ? `VAT ID: ${settings.impressumVatId}` : '',
  ].filter(Boolean)

  return `${settings.labelName} — Account invitation

You have been invited to join ${settings.labelName} as ${roleLabel(role)}.

Accept your invitation:
${inviteUrl}

This link expires after a limited time. If you did not expect this invitation, you can safely ignore this email.

—
${footerLines.join('\n')}`
}

export async function sendInviteEmail(
  deps: SendInviteEmailDeps,
): Promise<{ success: boolean; error?: string }> {
  if (!deps.resendApiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  const siteUrl = deps.siteUrl.replace(/\/$/, '')
  const html = buildTransactionalEmailHtml({
    labelName: deps.settings.labelName,
    title: INVITE_EMAIL_SUBJECT,
    bodyHtml: buildInviteBodyHtml(deps.inviteUrl, deps.role, deps.settings.labelName),
    footerHtml: buildImpressumFooterHtml(deps.settings, siteUrl),
  })
  const text = buildInviteText(deps.inviteUrl, deps.role, deps.settings)

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
        subject: INVITE_EMAIL_SUBJECT,
        html,
        text,
      }),
    })
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    console.error('[sendInviteEmail] Resend fetch error:', msg)
    return { success: false, error: msg }
  }

  if (!resendRes.ok) {
    const errorText = await resendRes.text().catch(() => `HTTP ${resendRes.status}`)
    console.error(`[sendInviteEmail] Resend error ${resendRes.status}:`, errorText)
    return { success: false, error: errorText }
  }

  return { success: true }
}