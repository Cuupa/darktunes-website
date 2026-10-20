import { describe, expect, it } from 'vitest'
import { executeRegisteredTool, getRegisteredTool } from '@/lib/ai/tools/registry'
import type { AiActor } from '@/lib/ai/auth/requireAiActor'

const actor = {
  userId: 'user-1',
  role: 'artist',
  accessContext: 'artist',
  artistId: 'artist-1',
  serviceDb: {} as AiActor['serviceDb'],
  userDb: {} as AiActor['userDb'],
} satisfies AiActor

describe('tool registry', () => {
  it('should run echo_test and reject unknown tools', async () => {
    expect(getRegisteredTool('echo_test')?.classification).toBe('read')
    const ok = await executeRegisteredTool('echo_test', { ping: 'hi' }, { actor, requestId: 'r1' })
    expect(ok).toEqual({ ok: true, result: { pong: 'hi' } })
    const unknown = await executeRegisteredTool('drop_database', {}, { actor, requestId: 'r1' })
    expect(unknown).toEqual({ ok: false, error: 'Unknown tool: drop_database' })
  })

  it('should reject invalid echo arguments', async () => {
    const result = await executeRegisteredTool('echo_test', { nope: 1 }, { actor, requestId: 'r1' })
    expect(result.ok).toBe(false)
  })
})
