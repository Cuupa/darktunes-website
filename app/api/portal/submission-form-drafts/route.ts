/**
 * GET / PUT / DELETE /api/portal/submission-form-drafts?artistId=&formType=release|video
 *
 * Server-side draft storage for portal submission wizards.
 * Membership via withPortalMembershipWrite; DB via portalMemberWrite.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import {
  deleteSubmissionFormDraft,
  getSubmissionFormDraft,
  upsertSubmissionFormDraft,
} from '@/lib/api/submissionFormDrafts'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'

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

function artistIdFromReq(req: NextRequest): string | null {
  return req.nextUrl.searchParams.get('artistId')
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const ctx = await withPortalMembershipWrite(req, artistIdFromReq(req))
  const formType = parseFormType(req)
  const { value: draft } = await portalMemberWrite(
    ctx,
    { route: 'GET /api/portal/submission-form-drafts', table: 'submission_form_drafts', operation: 'select' },
    (db) => getSubmissionFormDraft(db, ctx.artist.id, ctx.user.id, formType),
  )
  return NextResponse.json({ draft })
})

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const ctx = await withPortalMembershipWrite(req, artistIdFromReq(req))
  const formType = parseFormType(req)
  const body = putBodySchema.parse(await req.json())

  const size = Buffer.byteLength(JSON.stringify(body.payload), 'utf8')
  if (size > MAX_PAYLOAD_BYTES) {
    throw new ApiError(413, 'Draft payload too large (max 512 KB)')
  }

  const { value: draft } = await portalMemberWrite(
    ctx,
    { route: 'PUT /api/portal/submission-form-drafts', table: 'submission_form_drafts', operation: 'upsert' },
    (db) =>
      upsertSubmissionFormDraft(db, {
        artistId: ctx.artist.id,
        userId: ctx.user.id,
        formType,
        payload: body.payload,
      }),
  )
  return NextResponse.json({ draft })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const ctx = await withPortalMembershipWrite(req, artistIdFromReq(req))
  const formType = parseFormType(req)
  await portalMemberWrite(
    ctx,
    { route: 'DELETE /api/portal/submission-form-drafts', table: 'submission_form_drafts', operation: 'delete' },
    (db) => deleteSubmissionFormDraft(db, ctx.artist.id, ctx.user.id, formType),
  )
  return NextResponse.json({ ok: true })
})
