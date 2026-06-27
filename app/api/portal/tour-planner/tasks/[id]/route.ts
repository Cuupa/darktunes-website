import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { deleteTourTask, getTourTaskById, updateTourTask } from '@/lib/api/tourTasks'
import { authenticateTourPlannerRequest, assertTourAccess } from '@/lib/portal/tourPlannerAuth'

const schema = z.object({ completed: z.boolean() })

function taskId(pathname: string): string {
  const id = pathname.split('/').pop()
  if (!id) throw new ApiError(400, 'Missing task id')
  return id
}

async function assertTaskAccess(
  supabase: Awaited<ReturnType<typeof authenticateTourPlannerRequest>>['supabase'],
  artistId: string,
  id: string,
) {
  const task = await getTourTaskById(supabase, id)
  if (!task) throw new ApiError(404, 'Task not found')

  if (task.tourId) {
    await assertTourAccess(supabase, task.tourId, artistId)
  } else if (task.artistId !== artistId) {
    throw new ApiError(404, 'Task not found')
  }

  return task
}

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const body = schema.parse(await req.json())
  const id = taskId(req.nextUrl.pathname)
  await assertTaskAccess(supabase, artist.id, id)

  const task = await updateTourTask(supabase, id, { completed: body.completed })
  return NextResponse.json({ task })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const id = taskId(req.nextUrl.pathname)
  await assertTaskAccess(supabase, artist.id, id)

  await deleteTourTask(supabase, id)
  return NextResponse.json({ ok: true })
})