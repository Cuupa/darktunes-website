'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createRequest } from '@/lib/api/accreditations'

interface CreateAccreditationInput {
  eventName: string
  eventDate: string
  publication: string
  reason: string
}

export async function createAccreditationRequest(input: CreateAccreditationInput) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  return createRequest(supabase, {
    journalist_id: user.id,
    event_name: input.eventName,
    event_date: input.eventDate,
    publication: input.publication,
    reason: input.reason,
  })
}
