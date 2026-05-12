'use server'

import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const schema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
})

export async function updatePortalPassword(input: { newPassword: string; confirmPassword: string }) {
  const parsed = schema.parse(input)

  if (parsed.newPassword !== parsed.confirmPassword) {
    throw new Error('Passwords do not match.')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.auth.updateUser({ password: parsed.newPassword })
  if (error) throw new Error(error.message)
}
