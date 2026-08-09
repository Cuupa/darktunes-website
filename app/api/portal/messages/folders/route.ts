/**
 * app/api/portal/messages/folders/route.ts
 *
 * GET/POST/PATCH/DELETE — portal message folders.
 * Auth: Bearer (preferred) or cookie (dual-auth window).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, withErrorHandler } from '@/lib/errors'
import {
  getPortalFolders,
  createPortalFolder,
  updatePortalFolder,
  deletePortalFolder,
} from '@/lib/api/portalMessages'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'

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

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const artistId = new URL(req.url).searchParams.get('artistId')
  if (!artistId) throw new ApiError(400, 'artistId is required')

  const ctx = await withPortalMembershipWrite(req, artistId)
  const { value: folders } = await portalMemberWrite(
    ctx,
    { route: 'GET /api/portal/messages/folders', table: 'portal_message_folders', operation: 'select' },
    (db) => getPortalFolders(db, artistId),
  )
  return NextResponse.json({ folders })
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const body: unknown = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((e) => e.message).join('; '), 'VALIDATION_ERROR')
  }

  const { artistId, name, color, icon } = parsed.data
  const ctx = await withPortalMembershipWrite(req, artistId)
  const { value: folder } = await portalMemberWrite(
    ctx,
    { route: 'POST /api/portal/messages/folders', table: 'portal_message_folders', operation: 'insert' },
    (db) => createPortalFolder(db, artistId, name, color ?? undefined, icon ?? undefined),
  )
  return NextResponse.json({ folder }, { status: 201 })
})

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const body: unknown = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((e) => e.message).join('; '), 'VALIDATION_ERROR')
  }

  const { folderId, artistId, ...updates } = parsed.data
  const ctx = await withPortalMembershipWrite(req, artistId)
  await portalMemberWrite(
    ctx,
    { route: 'PATCH /api/portal/messages/folders', table: 'portal_message_folders', operation: 'update' },
    (db) => updatePortalFolder(db, folderId, updates),
  )
  return NextResponse.json({ success: true })
})

export const DELETE = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const body: unknown = await req.json()
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((e) => e.message).join('; '), 'VALIDATION_ERROR')
  }

  const { folderId, artistId } = parsed.data
  const ctx = await withPortalMembershipWrite(req, artistId)
  await portalMemberWrite(
    ctx,
    { route: 'DELETE /api/portal/messages/folders', table: 'portal_message_folders', operation: 'delete' },
    (db) => deletePortalFolder(db, folderId),
  )
  return NextResponse.json({ success: true })
})
