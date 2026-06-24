/**
 * app/api/health/route.ts — System health check
 *
 * GET /api/health
 *
 * Public endpoint (no auth required — returns only non-sensitive status info).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { withErrorHandler } from '@/lib/errors'
import { buildHealthSnapshot } from '@/lib/health/healthSnapshot'
import type { HealthResponse } from '@/lib/health/types'

export type { HealthResponse } from '@/lib/health/types'

export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const db =
    supabaseUrl && supabaseKey
      ? createClient<Database>(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
        })
      : null

  const snapshot = await buildHealthSnapshot({ db })

  // Reserve 503 for database reachability — missing API keys or sync issues stay 200 with body status.
  const httpStatus = snapshot.database.status === 'offline' ? 503 : 200

  return NextResponse.json(snapshot satisfies HealthResponse, {
    status: httpStatus,
  })
})

export const HEAD = withErrorHandler(async (req): Promise<NextResponse> => {
  const res = await GET(req)
  return new NextResponse(null, { status: res.status })
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