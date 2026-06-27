import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler } from '@/lib/errors'
import { createTourTask, getTourTasksByArtistId } from '@/lib/api/tourTasks'
import { authenticateTourPlannerRequest } from '@/lib/portal/tourPlannerAuth'

const createSchema = z.object({
  title: z.string().min(1),
  dueDate: z.string().min(1),
  tourId: z.string().uuid().nullable().optional(),
  stopId: z.string().uuid().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  taskType: z.string().default('other'),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const tourId = req.nextUrl.searchParams.get('tourId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const tasks = await getTourTasksByArtistId(supabase, artist.id, tourId)
  return NextResponse.json({ tasks })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const body = createSchema.parse(await req.json())
  const task = await createTourTask(supabase, {
    artist_id: artist.id,
    title: body.title,
    due_date: body.dueDate,
    tour_id: body.tourId ?? null,
    stop_id: body.stopId ?? null,
    priority: body.priority,
    task_type: body.taskType,
  })
  return NextResponse.json({ task }, { status: 201 })
})