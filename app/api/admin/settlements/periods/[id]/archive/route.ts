import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { archivePeriodWithCarryForward } from '@/lib/api/settlementRegister'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  nextPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nextPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing period id')

  const body: unknown = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((i) => i.message).join('; '))
  }

  const supabase = await createServerSupabaseClient()
  await archivePeriodWithCarryForward(
    supabase,
    id,
    userId,
    parsed.data.nextPeriodStart,
    parsed.data.nextPeriodEnd,
  )

  return NextResponse.json({ success: true })
})