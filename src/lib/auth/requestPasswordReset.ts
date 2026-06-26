/**
 * Password recovery: branded Resend email when configured,
 * Supabase resetPasswordForEmail fallback otherwise.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getSiteSettings } from '@/lib/api/siteSettings'
import { getPasswordRecoveryRedirectUrl } from '@/lib/auth/resolveRedirectPath'
import { sendPasswordResetEmail } from '@/lib/email/sendPasswordResetEmail'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>

export type PasswordResetChannel = 'resend' | 'supabase_fallback'

export interface RequestPasswordResetDeps {
  resendApiKey: string | null
  resendFromEmail: string
  siteUrl: string
  fetch: typeof globalThis.fetch
}

export interface RequestPasswordResetResult {
  sent: boolean
  silent?: boolean
  channel?: PasswordResetChannel
  error?: string
}

async function sendViaSupabaseFallback(
  client: DbClient,
  email: string,
  siteUrl: string,
): Promise<RequestPasswordResetResult> {
  const redirectTo = getPasswordRecoveryRedirectUrl(siteUrl)
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })

  if (error) {
    console.warn('[requestPasswordReset] Supabase fallback failed:', error.message)
    return { sent: false, silent: true, channel: 'supabase_fallback' }
  }

  return { sent: true, channel: 'supabase_fallback' }
}

export async function requestPasswordReset(
  adminClient: DbClient,
  email: string,
  deps: RequestPasswordResetDeps,
): Promise<RequestPasswordResetResult> {
  const normalizedEmail = email.trim()
  const siteUrl = deps.siteUrl.replace(/\/$/, '')

  if (!deps.resendApiKey) {
    console.warn(
      '[requestPasswordReset] Resend not configured — falling back to Supabase recovery email',
    )
    return sendViaSupabaseFallback(adminClient, normalizedEmail, siteUrl)
  }

  const redirectTo = getPasswordRecoveryRedirectUrl(siteUrl)

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: normalizedEmail,
    options: { redirectTo },
  })

  if (error || !data.properties?.action_link) {
    console.warn('[requestPasswordReset] generateLink failed:', error?.message ?? 'no action_link')
    return { sent: false, silent: true, channel: 'resend' }
  }

  const settings = await getSiteSettings(adminClient)

  const sendResult = await sendPasswordResetEmail({
    recipientEmail: normalizedEmail,
    resetUrl: data.properties.action_link,
    settings,
    resendApiKey: deps.resendApiKey,
    resendFromEmail: deps.resendFromEmail,
    siteUrl,
    fetch: deps.fetch,
  })

  if (!sendResult.success) {
    console.warn(
      '[requestPasswordReset] Resend send failed — falling back to Supabase recovery email:',
      sendResult.error,
    )
    return sendViaSupabaseFallback(adminClient, normalizedEmail, siteUrl)
  }

  return { sent: true, channel: 'resend' }
}