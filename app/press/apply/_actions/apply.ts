'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

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
    }
    return { status: 'pending' }
  } catch {
    return { status: 'error' }
  }
}
