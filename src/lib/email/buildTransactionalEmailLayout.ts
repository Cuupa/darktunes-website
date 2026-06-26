/**
 * Shared HTML layout for branded transactional emails (Resend).
 */

import type { SiteSettings } from '@/types'

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/** Escape a URL for safe use inside an HTML href attribute (ampersands in query strings). */
export function escapeHref(url: string): string {
  return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function formatAddress(address: string): string {
  return escapeHtml(address).replace(/\n/g, '<br />')
}

export function buildImpressumFooterHtml(settings: SiteSettings, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '')
  const year = new Date().getFullYear()
  const lines: string[] = []

  if (settings.impressumCompanyName) {
    lines.push(`<p style="margin: 0 0 4px; font-weight: 600; color: #888888;">${escapeHtml(settings.impressumCompanyName)}</p>`)
  }
  if (settings.impressumLegalForm) {
    lines.push(`<p style="margin: 0 0 4px; color: #666666;">${escapeHtml(settings.impressumLegalForm)}</p>`)
  }
  if (settings.impressumAddress) {
    lines.push(`<p style="margin: 0 0 8px; color: #666666; line-height: 1.5;">${formatAddress(settings.impressumAddress)}</p>`)
  }
  if (settings.impressumRepresentative) {
    lines.push(
      `<p style="margin: 0 0 4px; color: #666666;">Represented by: ${escapeHtml(settings.impressumRepresentative)}</p>`,
    )
  }
  if (settings.impressumPhone) {
    lines.push(`<p style="margin: 0 0 4px; color: #666666;">Phone: ${escapeHtml(settings.impressumPhone)}</p>`)
  }
  if (settings.impressumEmail) {
    lines.push(
      `<p style="margin: 0 0 4px; color: #666666;">Email: <a href="mailto:${escapeHtml(settings.impressumEmail)}" style="color: #888888;">${escapeHtml(settings.impressumEmail)}</a></p>`,
    )
  }
  if (settings.impressumVatId) {
    lines.push(`<p style="margin: 0 0 4px; color: #666666;">VAT ID: ${escapeHtml(settings.impressumVatId)}</p>`)
  }
  if (settings.impressumRegisterCourt || settings.impressumRegisterNumber) {
    const registerParts = [settings.impressumRegisterCourt, settings.impressumRegisterNumber]
      .filter(Boolean)
      .map((part) => escapeHtml(part))
    lines.push(`<p style="margin: 0 0 8px; color: #666666;">${registerParts.join(' — ')}</p>`)
  }

  const legalLinks = [
    `<a href="${base}/impressum" style="color: #666666; text-decoration: underline;">Legal notice</a>`,
    `<a href="${base}/datenschutz" style="color: #666666; text-decoration: underline;">Privacy policy</a>`,
  ]

  return `
    <tr>
      <td style="padding: 24px 32px; border-top: 1px solid #2a2a2a;">
        ${lines.join('\n')}
        <p style="margin: 12px 0 0; font-size: 11px; color: #555555; line-height: 1.6;">
          ${legalLinks.join(' &nbsp;|&nbsp; ')}
        </p>
        <p style="margin: 12px 0 0; font-size: 11px; color: #444444;">
          &copy; ${year} ${escapeHtml(settings.labelName)}. All rights reserved.
        </p>
      </td>
    </tr>`
}

export interface TransactionalEmailLayoutOptions {
  labelName: string
  title: string
  bodyHtml: string
  footerHtml: string
}

export function buildTransactionalEmailHtml(options: TransactionalEmailLayoutOptions): string {
  const { labelName, title, bodyHtml, footerHtml } = options

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0e0e0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0e0e0e; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #1a1a1a; border-radius: 8px; overflow: hidden; border: 1px solid #2a2a2a;">
          <tr>
            <td style="background-color: #493687; padding: 24px 32px;">
              <p style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">${escapeHtml(labelName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              ${bodyHtml}
            </td>
          </tr>
          ${footerHtml}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildCtaButtonHtml(label: string, href: string): string {
  const safeHref = escapeHref(href)
  return `<table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
    <tr>
      <td style="border-radius: 6px; background-color: #493687;">
        <a href="${safeHref}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #493687;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`
}

export function buildPlainUrlFallbackHtml(url: string): string {
  const safeHref = escapeHref(url)
  return `<p style="margin: 16px 0 0; color: #666666; font-size: 13px; line-height: 1.6;">
    If the button does not work, copy and paste this link into your browser:<br />
    <a href="${safeHref}" style="color: #493687; word-break: break-all;">${escapeHtml(url)}</a>
  </p>`
}