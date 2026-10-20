import { z } from 'zod'
import { registerTool } from '@/lib/ai/tools/registry'
import { getAllReleaseSubmissions } from '@/lib/api/releaseSubmissions'
import { getCachedHealthSnapshot } from '@/lib/health/cachedHealthSnapshot'
import { getSyncQueueStats } from '@/lib/api/syncQueue'

registerTool({
  name: 'get_label_analytics',
  description: 'Label-wide stream and revenue snapshot for admins.',
  input: z.object({}),
  output: z.object({
    available: z.boolean(),
    total_streams: z.number().optional(),
    total_revenue: z.number().optional(),
    artists_with_data: z.number().optional(),
    reason: z.string().optional(),
  }),
  capabilities: ['admin.panel.full'],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 4000,
  timeoutMs: 12_000,
  execute: async (_input, context) => {
    const { getLabelAnalyticsSnapshot } = await import('@/lib/api/labelAnalytics')
    const snapshot = await getLabelAnalyticsSnapshot(context.actor.serviceDb)
    return {
      available: true,
      total_streams: snapshot.totalLabelStreams,
      total_revenue: snapshot.totalLabelRevenue,
      artists_with_data: snapshot.artistCountWithData,
    }
  },
})

registerTool({
  name: 'get_artist_overview',
  description: 'List visible artists and whether they have a photo (incomplete-profile hint).',
  input: z.object({}),
  output: z.object({
    artists: z.array(
      z.object({
        name: z.string(),
        slug: z.string(),
        has_photo: z.boolean(),
      }),
    ),
  }),
  capabilities: ['admin.panel.full'],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 8000,
  timeoutMs: 10_000,
  execute: async (_input, context) => {
    const { getArtists } = await import('@/lib/api/artists')
    const artists = await getArtists(context.actor.serviceDb)
    return {
      artists: artists.slice(0, 40).map((artist) => ({
        name: artist.name,
        slug: artist.slug,
        has_photo: Boolean(artist.imageUrl),
      })),
    }
  },
})

registerTool({
  name: 'get_pending_submissions',
  description: 'List recent release submissions waiting on the label.',
  input: z.object({}),
  output: z.object({
    submissions: z.array(z.object({ title: z.string(), status: z.string(), created_at: z.string() })),
  }),
  capabilities: ['admin.panel.editor'],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 8000,
  timeoutMs: 8000,
  execute: async (_input, context) => {
    const rows = await getAllReleaseSubmissions(context.actor.serviceDb)
    const pending = rows.filter((row) => row.status === 'received' || row.status === 'reviewed')
    return {
      submissions: pending.slice(0, 20).map((row) => ({
        title: row.title,
        status: row.status,
        created_at: row.createdAt,
      })),
    }
  },
})

registerTool({
  name: 'get_system_health',
  description: 'Get overall system health status for admins.',
  input: z.object({}),
  output: z.object({
    available: z.boolean(),
    overall: z.string().optional(),
    reason: z.string().optional(),
  }),
  capabilities: ['admin.panel.full'],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 4000,
  timeoutMs: 10_000,
  execute: async () => {
    try {
      const snapshot = await getCachedHealthSnapshot()
      return { available: true, overall: snapshot.status }
    } catch {
      return { available: false, reason: 'Health snapshot is unavailable.' }
    }
  },
})

registerTool({
  name: 'get_sync_job_status',
  description: 'Get sync queue counts (pending, running, failed).',
  input: z.object({}),
  output: z.object({
    pending: z.number(),
    running: z.number(),
    failed: z.number(),
    done: z.number(),
  }),
  capabilities: ['admin.panel.full'],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 2000,
  timeoutMs: 8000,
  execute: async (_input, context) => {
    const stats = await getSyncQueueStats(context.actor.serviceDb)
    return {
      pending: stats.pending,
      running: stats.running,
      failed: stats.failed,
      done: stats.done,
    }
  },
})

registerTool({
  name: 'get_recent_app_errors',
  description: 'List recent aggregated application errors. No raw stack traces.',
  input: z.object({}),
  output: z.object({
    available: z.boolean(),
    errors: z.array(
      z.object({
        fingerprint: z.string().nullable(),
        source: z.string(),
        message: z.string(),
        occurrences: z.number(),
        last_seen_at: z.string(),
      }),
    ),
    reason: z.string().optional(),
  }),
  capabilities: ['admin.panel.full'],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 8000,
  timeoutMs: 8000,
  execute: async (_input, context) => {
    const { data, error } = await context.actor.serviceDb
      .from('app_logs')
      .select('fingerprint, source, message, occurrences, last_seen_at')
      .eq('level', 'error')
      .eq('ignored', false)
      .order('last_seen_at', { ascending: false })
      .limit(15)
    if (error) return { available: false, errors: [], reason: 'The error log could not be read.' }
    return {
      available: true,
      errors: (data ?? []).map((row) => ({
        fingerprint: row.fingerprint,
        source: row.source,
        message: row.message.slice(0, 240),
        occurrences: row.occurrences,
        last_seen_at: row.last_seen_at,
      })),
    }
  },
})

registerTool({
  name: 'get_error_occurrences',
  description: 'Look up one error fingerprint and its occurrence count.',
  input: z.object({ fingerprint: z.string().min(4).max(200) }),
  output: z.object({
    available: z.boolean(),
    fingerprint: z.string().optional(),
    occurrences: z.number().optional(),
    first_seen_at: z.string().optional(),
    last_seen_at: z.string().optional(),
    reason: z.string().optional(),
  }),
  capabilities: ['admin.panel.full'],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 2000,
  timeoutMs: 5000,
  execute: async (input, context) => {
    const { data } = await context.actor.serviceDb
      .from('app_logs')
      .select('fingerprint, occurrences, first_seen_at, last_seen_at')
      .eq('fingerprint', input.fingerprint)
      .maybeSingle()
    if (!data) return { available: false, reason: 'No log row matches that fingerprint.' }
    return {
      available: true,
      fingerprint: data.fingerprint ?? input.fingerprint,
      occurrences: data.occurrences,
      first_seen_at: data.first_seen_at,
      last_seen_at: data.last_seen_at,
    }
  },
})

registerTool({
  name: 'get_storage_health',
  description: 'Catalog storage usage for the media bucket.',
  input: z.object({}),
  output: z.object({
    available: z.boolean(),
    used_bytes: z.number().optional(),
    asset_count: z.number().optional(),
    reason: z.string().optional(),
  }),
  capabilities: ['admin.panel.full'],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 2000,
  timeoutMs: 10_000,
  execute: async (_input, context) => {
    try {
      const { resolveCatalogStorageStats } = await import('@/lib/assets/storageStats')
      const stats = await resolveCatalogStorageStats(context.actor.serviceDb)
      return { available: true, used_bytes: stats.usedBytes, asset_count: stats.assetCount }
    } catch {
      return { available: false, reason: 'Storage stats could not be read.' }
    }
  },
})

registerTool({
  name: 'get_known_errors',
  description: 'List fingerprints excluded from automatic support tickets.',
  input: z.object({}),
  output: z.object({
    errors: z.array(z.object({ fingerprint: z.string(), label: z.string(), active: z.boolean() })),
  }),
  capabilities: ['admin.panel.full'],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 4000,
  timeoutMs: 5000,
  execute: async (_input, context) => {
    const { listKnownErrors } = await import('@/lib/api/zammadSupport')
    const rows = await listKnownErrors(context.actor.serviceDb)
    return {
      errors: rows.slice(0, 30).map((row) => ({
        fingerprint: row.fingerprint,
        label: row.label,
        active: row.active,
      })),
    }
  },
})

registerTool({
  name: 'get_support_ticket_status',
  description: 'List recent Zammad ticket log rows (no customer PII beyond status).',
  input: z.object({}),
  output: z.object({
    tickets: z.array(
      z.object({
        status: z.string(),
        ticket_type: z.string(),
        title: z.string(),
        created_at: z.string(),
      }),
    ),
  }),
  capabilities: ['admin.panel.full'],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 6000,
  timeoutMs: 5000,
  execute: async (_input, context) => {
    const { listTicketLog } = await import('@/lib/api/zammadSupport')
    const rows = await listTicketLog(context.actor.serviceDb, 20)
    return {
      tickets: rows.map((row) => ({
        status: row.status,
        ticket_type: row.ticket_type,
        title: row.title.slice(0, 120),
        created_at: row.created_at,
      })),
    }
  },
})

registerTool({
  name: 'get_api_integration_status',
  description: 'Show which external API credentials are configured.',
  input: z.object({}),
  output: z.object({ configured: z.record(z.string(), z.boolean()) }),
  capabilities: ['admin.panel.full'],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 3000,
  timeoutMs: 8000,
  execute: async (_input, context) => {
    const { getKnownApiConfiguration } = await import('@/lib/secrets/getExternalCredentials')
    const configured = await getKnownApiConfiguration(context.actor.serviceDb)
    return { configured }
  },
})
