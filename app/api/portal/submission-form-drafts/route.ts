/**
 * GET / PUT / DELETE /api/portal/submission-form-drafts?artistId=&formType=release|video
 *
 * Server-side draft storage for portal submission wizards.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'
import {
  deleteSubmissionFormDraft,
  getSubmissionFormDraft,
  upsertSubmissionFormDraft,
} from '@/lib/api/submissionFormDrafts'

const formTypeSchema = z.enum(['release', 'video'])
const MAX_PAYLOAD_BYTES = 512 * 1024

const putBodySchema = z.object({
  payload: z.record(z.string(), z.unknown()),
})

function parseFormType(req: NextRequest): 'release' | 'video' {
  const raw =
    req.nextUrl.searchParams.get('formType') ??
    new URL(req.url).searchParams.get('formType') ??
    'release'
  return formTypeSchema.parse(raw)
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, user, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const formType = parseFormType(req)
  const draft = await getSubmissionFormDraft(supabase, artist.id, user.id, formType)
  return NextResponse.json({ draft })
})

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, user, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const formType = parseFormType(req)
  const body = putBodySchema.parse(await req.json())

  const size = Buffer.byteLength(JSON.stringify(body.payload), 'utf8')
  if (size > MAX_PAYLOAD_BYTES) {
    throw new ApiError(413, 'Draft payload too large (max 512 KB)')
  }

  const draft = await upsertSubmissionFormDraft(supabase, {
    artistId: artist.id,
    userId: user.id,
    formType,
    payload: body.payload,
  })
  return NextResponse.json({ draft })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, user, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const formType = parseFormType(req)
  await deleteSubmissionFormDraft(supabase, artist.id, user.id, formType)
  return NextResponse.json({ ok: true })
})
