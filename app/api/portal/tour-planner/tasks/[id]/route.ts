import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { deleteTourTask, updateTourTask } from '@/lib/api/tourTasks'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

const schema = z.object({ completed: z.boolean() })

function taskId(pathname: string): string {
  const id = pathname.split('/').pop()
  if (!id) throw new ApiError(400, 'Missing task id')
  return id
}

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const body = schema.parse(await req.json())
  const { data, error } = await supabase.from('tour_tasks').select('artist_id').eq('id', taskId(req.nextUrl.pathname)).single()
  if (error || !data || data.artist_id !== artist.id) throw new ApiError(404, 'Task not found')
  const task = await updateTourTask(supabase, taskId(req.nextUrl.pathname), { completed: body.completed })
  return NextResponse.json({ task })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const id = taskId(req.nextUrl.pathname)

  const { data, error } = await supabase.from('tour_tasks').select('artist_id').eq('id', id).single()
  if (error || !data || data.artist_id !== artist.id) throw new ApiError(404, 'Task not found')

  await deleteTourTask(supabase, id)
  return NextResponse.json({ ok: true })
})