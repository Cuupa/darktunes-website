import { describe, expect, it } from 'vitest'
import { executeRegisteredTool } from '@/lib/ai/tools'
import type { AiActor } from '@/lib/ai/auth/requireAiActor'
import { getAiConversationForUser } from '@/lib/api/aiConversations'
import { ApiError } from '@/lib/errors'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const artistActor = {
  userId: 'user-a',
  role: 'artist',
  accessContext: 'artist',
  artistId: 'artist-a',
  serviceDb: {} as AiActor['serviceDb'],
  userDb: {} as AiActor['userDb'],
} satisfies AiActor

describe('AI security', () => {
  it('should hide label tools from artists', async () => {
    await expect(
      executeRegisteredTool('get_system_health', {}, { actor: artistActor, requestId: 'r1' }),
    ).rejects.toMatchObject({ code: 'AI_TOOL_FORBIDDEN', status: 403 })
  })

  it('should refuse unknown tools instead of executing them', async () => {
    const result = await executeRegisteredTool('drop_database', {}, { actor: artistActor, requestId: 'r1' })
    expect(result).toEqual({ ok: false, error: 'Unknown tool: drop_database' })
  })

  it('should not return another user’s conversation', async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'conv-1',
                user_id: 'user-b',
                artist_id: 'artist-b',
                access_context: 'artist',
                title: 'secret',
                status: 'active',
                created_at: '',
                updated_at: '',
              },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>

    await expect(getAiConversationForUser(db, 'conv-1', 'user-a')).rejects.toBeInstanceOf(ApiError)
  })
})
