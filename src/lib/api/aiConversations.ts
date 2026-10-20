import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/errors'
import type { Database } from '@/types/database'
import type { AiAccessContext } from '@/lib/ai/auth/requireAiActor'

type Db = SupabaseClient<Database>
type ConversationRow = Database['public']['Tables']['ai_conversations']['Row']
type MessageRow = Database['public']['Tables']['ai_messages']['Row']

export interface AiConversation {
  id: string
  userId: string
  artistId: string | null
  accessContext: AiAccessContext
  title: string
  status: ConversationRow['status']
  createdAt: string
  updatedAt: string
}

export interface AiMessageRecord {
  id: string
  conversationId: string
  role: MessageRow['role']
  content: string
  model: string | null
  tokenUsage: Record<string, unknown>
  status: MessageRow['status']
  createdAt: string
}

function rowToConversation(row: ConversationRow): AiConversation {
  return {
    id: row.id,
    userId: row.user_id,
    artistId: row.artist_id,
    accessContext: row.access_context,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToMessage(row: MessageRow): AiMessageRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    model: row.model,
    tokenUsage: row.token_usage,
    status: row.status,
    createdAt: row.created_at,
  }
}

export async function createAiConversation(
  db: Db,
  input: {
    userId: string
    artistId: string | null
    accessContext: AiAccessContext
    title?: string
  },
): Promise<AiConversation> {
  const { data, error } = await db
    .from('ai_conversations')
    .insert({
      user_id: input.userId,
      artist_id: input.artistId,
      access_context: input.accessContext,
      title: input.title ?? '',
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToConversation(data)
}

export async function listAiConversations(
  db: Db,
  input: { userId: string; artistId: string | null; cursor?: string | null; limit?: number },
): Promise<{ items: AiConversation[]; next_cursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  let query = db
    .from('ai_conversations')
    .select('*')
    .eq('user_id', input.userId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(limit + 1)
  if (input.artistId) query = query.eq('artist_id', input.artistId)
  else query = query.is('artist_id', null)
  if (input.cursor) query = query.lt('updated_at', input.cursor)
  const { data, error } = await query
  if (error) throw error
  const rows = data ?? []
  const hasMore = rows.length > limit
  const slice = hasMore ? rows.slice(0, limit) : rows
  return {
    items: slice.map(rowToConversation),
    next_cursor: hasMore ? slice[slice.length - 1]?.updated_at ?? null : null,
  }
}

export async function getAiConversationForUser(
  db: Db,
  conversationId: string,
  userId: string,
): Promise<AiConversation> {
  const { data, error } = await db
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle()
  if (error) throw error
  if (!data || data.user_id !== userId || data.status === 'deleted') {
    throw new ApiError(404, 'That assistant conversation was not found or belongs to another account.', 'AI_CONVERSATION_NOT_FOUND')
  }
  return rowToConversation(data)
}

export async function deleteAiConversation(db: Db, conversationId: string, userId: string): Promise<void> {
  await getAiConversationForUser(db, conversationId, userId)
  const { error } = await db
    .from('ai_conversations')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function listAiMessages(
  db: Db,
  conversationId: string,
  limit = 50,
): Promise<AiMessageRecord[]> {
  const { data, error } = await db
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(rowToMessage)
}

export async function insertAiMessage(
  db: Db,
  input: {
    conversationId: string
    role: MessageRow['role']
    content: string
    model?: string | null
    tokenUsage?: Record<string, unknown>
    status?: MessageRow['status']
  },
): Promise<AiMessageRecord> {
  const { data, error } = await db
    .from('ai_messages')
    .insert({
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content,
      model: input.model ?? null,
      token_usage: input.tokenUsage ?? {},
      status: input.status ?? 'complete',
    })
    .select('*')
    .single()
  if (error) throw error
  await db
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.conversationId)
  return rowToMessage(data)
}
