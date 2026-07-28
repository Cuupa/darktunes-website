'use server'

import { strongPasswordPairSchema } from '@/lib/auth/passwordPolicy'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function updatePortalPassword(input: {
  newPassword: string
  confirmPassword: string
}) {
  const parsed = strongPasswordPairSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid password')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })
  if (error) throw new Error(error.message)
}
