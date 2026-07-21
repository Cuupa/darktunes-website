/**
 * app/api/health/route.ts — System health check
 *
 * GET /api/health              — Database liveness only (default)
 * GET /api/health?mode=full    — Full dashboard snapshot (60s server cache)
 * GET /api/health?mode=full&fresh=1 — Bypass cache (manual admin refresh)
 * HEAD /api/health             — Liveness probe only (no JSON body)
 */

import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { isValidCronSecret } from '@/lib/cronAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { getCachedHealthSnapshot } from '@/lib/health/cachedHealthSnapshot'
import { createHealthDbClient } from '@/lib/health/healthDbClient'
import { buildHealthLivenessResponse } from '@/lib/health/healthLiveness'
import { buildHealthSnapshot } from '@/lib/health/healthSnapshot'
import type { HealthLivenessResponse, HealthResponse } from '@/lib/health/types'

export type { HealthResponse } from '@/lib/health/types'

const HEALTH_CACHE_CONTROL = 'private, max-age=60'

function isFullHealthRequest(req: NextRequest): boolean {
  const url = new URL(req.url)
  return url.searchParams.get('mode') === 'full'
}

function databaseHttpStatus(databaseStatus: string): number {
  return databaseStatus === 'offline' ? 503 : 200
}

async function assertFullHealthAuthorized(req: NextRequest): Promise<void> {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && isValidCronSecret(authHeader, cronSecret)) {
    return
  }

  try {
    const token = extractBearerToken(authHeader)
    await verifyAdmin(token)
  } catch {
    throw new ApiError(401, 'Unauthorized')
  }
}

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const db = createHealthDbClient()

  if (!isFullHealthRequest(req)) {
    const liveness = await buildHealthLivenessResponse(db)
    return NextResponse.json(liveness satisfies HealthLivenessResponse, {
      status: databaseHttpStatus(liveness.database.status),
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  await assertFullHealthAuthorized(req)

  const url = new URL(req.url)
  const fresh = url.searchParams.get('fresh') === '1'
  const snapshot = fresh
    ? await buildHealthSnapshot({ db })
    : await getCachedHealthSnapshot()

  const httpStatus = databaseHttpStatus(snapshot.database.status)

  return NextResponse.json(snapshot satisfies HealthResponse, {
    status: httpStatus,
    headers: { 'Cache-Control': HEALTH_CACHE_CONTROL },
  })
})

export const HEAD = withErrorHandler(async (): Promise<NextResponse> => {
  const db = createHealthDbClient()
  const liveness = await buildHealthLivenessResponse(db)
  return new NextResponse(null, {
    status: databaseHttpStatus(liveness.database.status),
    headers: { 'Cache-Control': 'no-store' },
  })
})

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}