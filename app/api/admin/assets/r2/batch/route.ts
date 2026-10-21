import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { withErrorHandler } from '@/lib/errors'
import { createConfiguredR2Client } from '@/lib/r2Utils'
import { deleteR2ObjectsBatch } from '@/lib/r2/explorer'

export const DELETE = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const { s3, bucket } = await createConfiguredR2Client()
  const body = (await request.json()) as { keys?: unknown }
  const keys = Array.isArray(body.keys)
    ? body.keys.filter((key): key is string => typeof key === 'string' && key.length > 0)
    : []
  if (keys.length === 0) {
    return NextResponse.json({ deleted: 0, failed: 0 })
  }

  const result = await deleteR2ObjectsBatch(s3, bucket, keys)
  return NextResponse.json(result)
})
