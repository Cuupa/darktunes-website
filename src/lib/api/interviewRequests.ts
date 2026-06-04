import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { InterviewRequest } from '@/types'

type DbClient = SupabaseClient<Database>
type InterviewRequestRow = Database['public']['Tables']['interview_requests']['Row']
export type InterviewRequestInsert = Database['public']['Tables']['interview_requests']['Insert']
export type InterviewRequestUpdate = Database['public']['Tables']['interview_requests']['Update']

function rowToInterviewRequest(row: InterviewRequestRow): InterviewRequest {
  return {
    id: row.id,
    journalistId: row.journalist_id,
    artistId: row.artist_id,
    subject: row.subject,
    message: row.message,
    preferredDate: row.preferred_date ?? undefined,
    status: row.status,
    artistReply: row.artist_reply ?? undefined,
    createdAt: row.created_at,
  }
}

export async function createInterviewRequest(
  db: DbClient,
  data: InterviewRequestInsert,
): Promise<InterviewRequest> {
  const { data: row, error } = await db
    .from('interview_requests')
    .insert(data)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from createInterviewRequest')
  return rowToInterviewRequest(row)
}

export async function getInterviewRequestsByJournalistId(
  db: DbClient,
  journalistId: string,
): Promise<InterviewRequest[]> {
  const { data, error } = await db
    .from('interview_requests')
    .select('*')
    .eq('journalist_id', journalistId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToInterviewRequest)
}

export async function getInterviewRequestsByArtistId(
  db: DbClient,
  artistId: string,
): Promise<InterviewRequest[]> {
  const { data, error } = await db
    .from('interview_requests')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToInterviewRequest)
}

export async function updateInterviewRequest(
  db: DbClient,
  id: string,
  data: InterviewRequestUpdate,
): Promise<InterviewRequest> {
  const { data: row, error } = await db
    .from('interview_requests')
    .update(data)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from updateInterviewRequest')
  return rowToInterviewRequest(row)
}
