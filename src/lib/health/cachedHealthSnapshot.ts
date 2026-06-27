/**
 * src/lib/health/cachedHealthSnapshot.ts
 *
 * Short-TTL cache for the full enterprise health snapshot.
 */

import { unstable_cache } from 'next/cache'
import { buildHealthSnapshot } from './healthSnapshot'
import { createHealthDbClient } from './healthDbClient'
import type { HealthResponse } from './types'

const HEALTH_CACHE_TTL_SECONDS = 60

export const getCachedHealthSnapshot = unstable_cache(
  async (): Promise<HealthResponse> => {
    return buildHealthSnapshot({ db: createHealthDbClient() })
  },
  ['health-snapshot'],
  { revalidate: HEALTH_CACHE_TTL_SECONDS, tags: ['health-snapshot'] },
)