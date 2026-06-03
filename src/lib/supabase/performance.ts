import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
const SLOW_QUERY_THRESHOLD_MS = 1000

async function reportSlowQuery(url: string, durationMs: number): Promise<void> {
  const payload = {
    type: 'slow-supabase-query',
    endpoint: new URL(url).pathname,
    durationMs,
    thresholdMs: SLOW_QUERY_THRESHOLD_MS,
    timestamp: new Date().toISOString(),
  }

  if (typeof window !== 'undefined') {
    void fetch('/api/vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        name: 'TTFB',
        value: durationMs,
        delta: durationMs,
        rating: durationMs > 2500 ? 'poor' : durationMs > 1000 ? 'needs-improvement' : 'good',
        navigationType: payload.endpoint,
      }),
      keepalive: true,
    }).catch(() => {
      // Ignore analytics transport failures.
    })
  }
}

export const supabaseWithMetrics = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: async (input, init) => {
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const response = await fetch(input, init)
      const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const durationMs = endedAt - startedAt

      if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
        const requestUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url
        console.warn(
          `[Supabase Performance] Slow query detected (${durationMs.toFixed(0)}ms): ${requestUrl}`,
        )
        await reportSlowQuery(requestUrl, Math.round(durationMs))
      }

      return response
    },
  },
})
