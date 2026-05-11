/**
 * app/api/health/route.ts — System health check
 *
 * GET /api/health
 *
 * Public endpoint (no auth required — returns only non-sensitive status info).
 *
 * Returns:
 *   - Database connection status
 *   - API key configuration status for each external API
 *   - Last successful sync timestamp per API (from sync_logs)
 *   - Rate-limit warnings (if the most recent sync log shows rate_limited=true)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const API_SOURCES = ['itunes', 'spotify', 'discogs', 'songkick'] as const
type ApiSource = (typeof API_SOURCES)[number]

export interface ApiHealthStatus {
  configured: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'partial' | 'error' | null
  rateLimited: boolean
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  database: { status: 'online' | 'offline'; latencyMs: number | null }
  apis: Record<ApiSource, ApiHealthStatus>
  checkedAt: string
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const checkedAt = new Date().toISOString()

  // ---------------------------------------------------------------------------
  // 1. Database ping
  // ---------------------------------------------------------------------------
  let dbStatus: 'online' | 'offline' = 'offline'
  let latencyMs: number | null = null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const db = createClient<Database>(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      })
      const start = Date.now()
      const { error } = await db.from('sync_logs').select('id').limit(1)
      latencyMs = Date.now() - start
      if (!error) dbStatus = 'online'
    } catch {
      // dbStatus remains 'offline'
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Per-API key configuration + last sync status
  // ---------------------------------------------------------------------------
  const apiStatuses: Record<string, ApiHealthStatus> = {}
  const configured: Record<ApiSource, boolean> = {
    itunes: true, // iTunes requires no API key
    spotify: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    discogs: !!process.env.DISCOGS_TOKEN,
    songkick: !!process.env.SONGKICK_API_KEY,
  }

  if (supabaseUrl && supabaseKey && dbStatus === 'online') {
    const db = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })

    for (const api of API_SOURCES) {
      const { data } = await db
        .from('sync_logs')
        .select('created_at, status, rate_limited')
        .eq('api_source', api)
        .order('created_at', { ascending: false })
        .limit(1)

      const latest = data?.[0] ?? null
      apiStatuses[api] = {
        configured: configured[api],
        lastSyncAt: latest?.created_at ?? null,
        lastSyncStatus: (latest?.status as ApiHealthStatus['lastSyncStatus']) ?? null,
        rateLimited: latest?.rate_limited ?? false,
      }
    }
  } else {
    for (const api of API_SOURCES) {
      apiStatuses[api] = {
        configured: configured[api],
        lastSyncAt: null,
        lastSyncStatus: null,
        rateLimited: false,
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Overall status
  // ---------------------------------------------------------------------------
  const overallStatus: HealthResponse['status'] =
    dbStatus === 'offline' ? 'unhealthy' : Object.values(apiStatuses).some((s) => s.rateLimited) ? 'degraded' : 'healthy'

  return NextResponse.json(
    {
      status: overallStatus,
      database: { status: dbStatus, latencyMs },
      apis: apiStatuses as Record<ApiSource, ApiHealthStatus>,
      checkedAt,
    },
    { status: overallStatus === 'unhealthy' ? 503 : 200 },
  )
}

export async function HEAD(): Promise<NextResponse> {
  const res = await GET()
  return new NextResponse(null, { status: res.status })
}

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
