/**
 * app/api/portal/messages/folders/route.ts
 *
 * GET  /api/portal/messages/folders?artistId=<uuid>  — list folders
 * POST /api/portal/messages/folders                  — create folder
 *
 * Security: caller must be a member of the artistId.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { getPortalFolders, createPortalFolder, updatePortalFolder, deletePortalFolder } from '@/lib/api/portalMessages'

const createSchema = z.object({
  artistId: z.string().uuid(),
  name: z.string().min(1).max(100),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
})

const patchSchema = z.object({
  folderId: z.string().uuid(),
  artistId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
})

const deleteSchema = z.object({
  folderId: z.string().uuid(),
  artistId: z.string().uuid(),
})

async function checkMembership(supabase: ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never, artistId: string, userId: string) {
  const { data } = await supabase
    .from('artist_members')
    .select('id')
    .eq('artist_id', artistId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const artistId = new URL(req.url).searchParams.get('artistId')
  if (!artistId) throw new ApiError(400, 'artistId is required')

  if (!(await checkMembership(supabase, artistId, user.id))) {
    throw new ApiError(403, 'Not a member of this artist')
  }

  const folders = await getPortalFolders(supabase, artistId)
  return NextResponse.json({ folders })
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const body: unknown = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((e) => e.message).join('; '), 'VALIDATION_ERROR')
  }

  const { artistId, name, color, icon } = parsed.data

  if (!(await checkMembership(supabase, artistId, user.id))) {
    throw new ApiError(403, 'Not a member of this artist')
  }

  const folder = await createPortalFolder(supabase, artistId, name, color ?? undefined, icon ?? undefined)
  return NextResponse.json({ folder }, { status: 201 })
})

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const body: unknown = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((e) => e.message).join('; '), 'VALIDATION_ERROR')
  }

  const { folderId, artistId, ...updates } = parsed.data

  if (!(await checkMembership(supabase, artistId, user.id))) {
    throw new ApiError(403, 'Not a member of this artist')
  }

  await updatePortalFolder(supabase, folderId, updates)
  return NextResponse.json({ success: true })
})

export const DELETE = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const body: unknown = await req.json()
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((e) => e.message).join('; '), 'VALIDATION_ERROR')
  }

  const { folderId, artistId } = parsed.data

  if (!(await checkMembership(supabase, artistId, user.id))) {
    throw new ApiError(403, 'Not a member of this artist')
  }

  await deletePortalFolder(supabase, folderId)
  return NextResponse.json({ success: true })
})
