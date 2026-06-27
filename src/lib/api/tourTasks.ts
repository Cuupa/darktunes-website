import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { TourTask } from '@/types'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['tour_tasks']['Row']
export type TourTaskInsert = Database['public']['Tables']['tour_tasks']['Insert']
export type TourTaskUpdate = Database['public']['Tables']['tour_tasks']['Update']

function rowToTask(row: Row): TourTask {
  return {
    id: row.id,
    artistId: row.artist_id,
    tourId: row.tour_id,
    stopId: row.stop_id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    priority: row.priority as TourTask['priority'],
    completed: row.completed,
    assignedTo: row.assigned_to,
    taskType: row.task_type as TourTask['taskType'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getTourTasksByArtistId(db: DbClient, artistId: string): Promise<TourTask[]> {
  const { data, error } = await db
    .from('tour_tasks')
    .select('*')
    .eq('artist_id', artistId)
    .order('due_date', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTask)
}

export async function createTourTask(db: DbClient, data: TourTaskInsert): Promise<TourTask> {
  const { data: row, error } = await db.from('tour_tasks').insert(data).select('*').single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from createTourTask')
  return rowToTask(row)
}

export async function updateTourTask(db: DbClient, id: string, data: TourTaskUpdate): Promise<TourTask> {
  const { data: row, error } = await db.from('tour_tasks').update(data).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from updateTourTask')
  return rowToTask(row)
}

export async function deleteTourTask(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('tour_tasks').delete().eq('id', id)
  if (error) throw new Error(error.message)
}