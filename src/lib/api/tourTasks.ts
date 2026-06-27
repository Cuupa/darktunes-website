import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { TourTask } from '@/types'
import { getCollaboratorTourIds } from '@/lib/api/tourCollaborators'

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

export async function getTourTasksForTour(db: DbClient, tourId: string): Promise<TourTask[]> {
  const { data, error } = await db
    .from('tour_tasks')
    .select('*')
    .eq('tour_id', tourId)
    .order('due_date', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTask)
}

export async function getTourTasksByArtistId(
  db: DbClient,
  artistId: string,
  tourId?: string | null,
): Promise<TourTask[]> {
  if (tourId) {
    return getTourTasksForTour(db, tourId)
  }

  const collaboratorTourIds = await getCollaboratorTourIds(db, artistId)
  const { data: ownedTours, error: ownedError } = await db
    .from('tours')
    .select('id')
    .eq('artist_id', artistId)
  if (ownedError) throw new Error(ownedError.message)

  const accessibleTourIds = [
    ...new Set([
      ...collaboratorTourIds,
      ...(ownedTours ?? []).map((row) => row.id),
    ]),
  ]

  if (accessibleTourIds.length === 0) {
    const { data, error } = await db
      .from('tour_tasks')
      .select('*')
      .eq('artist_id', artistId)
      .order('due_date', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []).map(rowToTask)
  }

  const { data, error } = await db
    .from('tour_tasks')
    .select('*')
    .or(`artist_id.eq.${artistId},tour_id.in.(${accessibleTourIds.join(',')})`)
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

export async function getTourTaskById(db: DbClient, taskId: string): Promise<TourTask | null> {
  const { data, error } = await db.from('tour_tasks').select('*').eq('id', taskId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToTask(data) : null
}