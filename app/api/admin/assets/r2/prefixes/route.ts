import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { withErrorHandler } from '@/lib/errors'
import { createConfiguredR2Client } from '@/lib/r2Utils'
import { collectPrefixStats } from '@/lib/r2/explorer'

export const GET = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const { s3, bucket } = await createConfiguredR2Client()
  const { searchParams } = new URL(request.url)
  const parent = searchParams.get('parent')?.trim() || null

  const prefixes = await collectPrefixStats(s3, bucket, parent)
  return NextResponse.json({ prefixes, parent })
})
