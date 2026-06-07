'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

async function sendPressApplicationNotification(data: {
  name: string
  email: string
  publication: string
}): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@darktunes.com'
  const adminEmail = process.env.CONTACT_EMAIL ?? 'info@darktunes.com'
  if (!resendApiKey) return

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com'

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + resendApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: adminEmail,
      subject: 'New Press Application: ' + data.name + ' (' + data.publication + ')',
      html:
        '<p>A new press portal application has been submitted.</p>' +
        '<ul>' +
        '<li><strong>Name:</strong> ' + data.name + '</li>' +
        '<li><strong>Email:</strong> ' + data.email + '</li>' +
        '<li><strong>Publication:</strong> ' + data.publication + '</li>' +
        '</ul>' +
        '<p><a href="' + siteUrl + '/admin/accreditations">Review in Admin →</a></p>',
    }),
  })
}

export async function submitPressApplication(data: {
  name: string
  email: string
  password: string
  publication: string
  website: string
  reason: string
}): Promise<{ status: 'pending' | 'error'; message?: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.name,
        },
      },
    })
    if (signUpError) {
      if (signUpError.message.toLowerCase().includes('already registered')) {
        return { status: 'error', message: 'emailInUse' }
      }
      return { status: 'error', message: signUpError.message }
    }
    if (authData.user) {
      await supabase.from('journalist_applications').insert({
        user_id: authData.user.id,
        email: data.email,
        name: data.name,
        outlet: data.publication,
        message: [data.website, data.reason].filter(Boolean).join('\n\n') || null,
      })

      // Notify admin via email (fire-and-forget — don't fail the signup if this fails)
      await sendPressApplicationNotification({
        name: data.name,
        email: data.email,
        publication: data.publication,
      }).catch(() => { /* non-critical */ })
    }
    return { status: 'pending' }
  } catch {
    return { status: 'error' }
  }
}
