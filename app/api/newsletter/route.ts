import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createPendingSubscriber } from '@/lib/api/newsletter'
import { ApiError, withErrorHandler } from '@/lib/errors'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().max(120).optional(),
})

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(422, parsed.error.errors[0]?.message ?? 'Validation error')
  }

  const { email, name } = parsed.data
  const verificationToken = randomUUID()

  const db = getServiceClient()
  if (db) {
    try {
      await createPendingSubscriber(db, email, verificationToken, name)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('23505') || message.toLowerCase().includes('duplicate')) {
        // Anti-enumeration: silent success for already-registered emails
        return NextResponse.json({ success: true })
      }
      console.error('[newsletter] createPendingSubscriber error:', message)
      throw new ApiError(500, 'Subscription failed. Please try again.')
    }
  }

  return NextResponse.json({ success: true })
})
