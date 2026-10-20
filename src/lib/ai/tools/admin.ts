import { z } from 'zod'
import { registerTool } from '@/lib/ai/tools/registry'
import { getAllReleaseSubmissions } from '@/lib/api/releaseSubmissions'
import { getCachedHealthSnapshot } from '@/lib/health/cachedHealthSnapshot'
import { getSyncQueueStats } from '@/lib/api/syncQueue'

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
