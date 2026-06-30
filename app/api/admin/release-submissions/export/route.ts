import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { getAllReleaseSubmissions } from '@/lib/api/releaseSubmissions'
import { getTracksBySubmissionIds } from '@/lib/api/releaseSubmissionTracks'
import { getAllFormSchemaFields } from '@/lib/api/submissionFormSchema'
import {
  buildSubmissionExportRows,
  buildSubmissionsCsv,
  buildSubmissionsExcel,
} from '@/lib/submissions/submissionExport'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const supabase = await createServiceRoleSupabaseClient()

  const format = req.nextUrl.searchParams.get('format') ?? 'csv'
  if (format !== 'csv' && format !== 'xlsx') {
    throw new ApiError(400, 'format must be csv or xlsx')
  }

  const statusFilter = req.nextUrl.searchParams.get('status')

  let submissions = await getAllReleaseSubmissions(supabase)
  if (statusFilter) {
    submissions = submissions.filter((s) => s.status === statusFilter)
  }

  const submissionIds = submissions.map((s) => s.id)
  const tracks = await getTracksBySubmissionIds(supabase, submissionIds)
  const tracksBySubmission = new Map<string, typeof tracks>()
  for (const track of tracks) {
    const list = tracksBySubmission.get(track.submissionId) ?? []
    list.push(track)
    tracksBySubmission.set(track.submissionId, list)
  }

  const artistIds = [...new Set(submissions.map((s) => s.artistId))]
  const { data: artists } = await supabase.from('artists').select('id, name').in('id', artistIds)
  const artistNames = new Map((artists ?? []).map((a) => [a.id, a.name]))

  const schemaFields = await getAllFormSchemaFields(supabase, 'release')
  const rows = buildSubmissionExportRows({
    submissions,
    tracksBySubmission,
    artistNames,
    schemaFields,
  })

  const stamp = new Date().toISOString().slice(0, 10)

  if (format === 'xlsx') {
    const buffer = await buildSubmissionsExcel(rows)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="release-submissions-${stamp}.xlsx"`,
      },
    })
  }

  const csv = buildSubmissionsCsv(rows)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="release-submissions-${stamp}.csv"`,
    },
  })
})