import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { getSalesStatementById } from '@/lib/api/salesStatements'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createR2Client } from '@/lib/r2Utils'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const EXPIRY_SECONDS = 600

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing statement id')

  const supabase = await createServerSupabaseClient()
  const statement = await getSalesStatementById(supabase, id)
  if (!statement?.r2Key) throw new ApiError(404, 'Statement PDF not found')

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME, Key: statement.r2Key }),
    { expiresIn: EXPIRY_SECONDS },
  )

  return NextResponse.json({ url })
})
