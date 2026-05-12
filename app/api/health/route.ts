/**
 * app/api/health/route.ts — System health check
 *
 * GET /api/health
 *
 * Public endpoint (no auth required — returns only non-sensitive status info).
 *
 * Returns:
 *   - Database connection status
 *   - Per-API last sync timestamp and status (auto-discovered from sync_logs)
 *   - Rate-limit warnings (if the most recent sync log shows rate_limited=true)
 *   - Last errors for partial/error syncs
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** Known API sources with their configuration check. Auto-discovery adds any others found in sync_logs. */
const KNOWN_APIS: Record<string, boolean> = {
  itunes: true, // no key required
  spotify: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
  discogs: !!process.env.DISCOGS_TOKEN,
  songkick: !!process.env.SONGKICK_API_KEY,
  bandsintown: !!process.env.BANDSINTOWN_APP_ID,
  odesli: true, // no key required
  youtube: !!process.env.YOUTUBE_API_KEY,
}

export interface ApiHealthStatus {
  configured: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'partial' | 'error' | null
  rateLimited: boolean
  lastErrors: string[]
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  database: { status: 'online' | 'offline'; latencyMs: number | null }
  apis: Record<string, ApiHealthStatus>
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
  // 2. Per-API status — auto-discover all api_source values from sync_logs
  // ---------------------------------------------------------------------------
  const apiStatuses: Record<string, ApiHealthStatus> = {}

  if (supabaseUrl && supabaseKey && dbStatus === 'online') {
    const db = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })

    // Fetch most recent sync log per api_source in a single query
    const { data: logs } = await db
      .from('sync_logs')
      .select('api_source, created_at, status, rate_limited, errors')
      .order('created_at', { ascending: false })

    // Group by api_source — keep only the latest entry per source
    const latestPerApi = new Map<string, {
      created_at: string
      status: string
      rate_limited: boolean
      errors: unknown
    }>()
    for (const row of logs ?? []) {
      if (!latestPerApi.has(row.api_source)) {
        latestPerApi.set(row.api_source, row)
      }
    }

    // Merge: all known APIs + any discovered from sync_logs
    const allApis = new Set([...Object.keys(KNOWN_APIS), ...latestPerApi.keys()])

    for (const api of allApis) {
      const latest = latestPerApi.get(api) ?? null
      const rawErrors = latest?.errors
      const lastErrors: string[] = Array.isArray(rawErrors)
        ? (rawErrors as unknown[]).map((e) => (typeof e === 'string' ? e : JSON.stringify(e)))
        : []

      apiStatuses[api] = {
        configured: KNOWN_APIS[api] ?? false,
        lastSyncAt: latest?.created_at ?? null,
        lastSyncStatus: (latest?.status as ApiHealthStatus['lastSyncStatus']) ?? null,
        rateLimited: latest?.rate_limited ?? false,
        lastErrors,
      }
    }
  } else {
    // DB offline — report known APIs only
    for (const api of Object.keys(KNOWN_APIS)) {
      apiStatuses[api] = {
        configured: KNOWN_APIS[api],
        lastSyncAt: null,
        lastSyncStatus: null,
        rateLimited: false,
        lastErrors: [],
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Overall status
  // ---------------------------------------------------------------------------
  const overallStatus: HealthResponse['status'] =
    dbStatus === 'offline'
      ? 'unhealthy'
      : Object.values(apiStatuses).some((s) => s.rateLimited)
        ? 'degraded'
        : 'healthy'

  return NextResponse.json(
    {
      status: overallStatus,
      database: { status: dbStatus, latencyMs },
      apis: apiStatuses,
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
