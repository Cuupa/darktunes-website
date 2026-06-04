'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export async function sendPressInquiry(data: {
  subject: string
  body: string
}): Promise<{ success: boolean }> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false }

    const { error } = await supabase.from('app_logs').insert({
      source: 'press_inquiry',
      level: 'info',
      message: `[${data.subject}] ${data.body}`,
      details: {
        body_html: `<p>${escapeHtml(data.body).replace(/\n+/g, '</p><p>')}</p>`,
        subject: data.subject,
        user_email: user.email ?? '',
      },
      user_id: user.id,
    })

    return { success: !error }
  } catch {
    return { success: false }
  }
}
