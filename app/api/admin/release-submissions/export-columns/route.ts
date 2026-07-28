import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { getAllFormSchemaFields } from '@/lib/api/submissionFormSchema'
import {
  DEFAULT_EXPORT_COLUMNS,
  collectAvailableExportKeys,
  listBaseExportColumnKeys,
  resolveExportColumns,
} from '@/lib/submissions/submissionExport'
import {
  getReleaseSubmissionExportColumns,
  setReleaseSubmissionExportColumns,
} from '@/lib/submissions/exportColumnSettings'

const putSchema = z.object({
  columns: z.array(z.string().min(1)).min(1).max(200),
})

async function loadAvailable() {
  const supabase = await createServiceRoleSupabaseClient()
  const schemaFields = await getAllFormSchemaFields(supabase, 'release')
  const available = resolveExportColumns(
    listBaseExportColumnKeys(),
    collectAvailableExportKeys([], schemaFields),
  )
  return { supabase, available }
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const { supabase, available } = await loadAvailable()
  const saved = await getReleaseSubmissionExportColumns(supabase)
  const columns = resolveExportColumns(saved, available)

  return NextResponse.json({
    columns,
    defaults: DEFAULT_EXPORT_COLUMNS,
    available,
  })
})

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const body = putSchema.parse(await req.json())
  const { supabase, available } = await loadAvailable()
  const availableSet = new Set(available)
  const columns = body.columns.filter((c) => availableSet.has(c))
  if (columns.length === 0) {
    throw new ApiError(400, 'No valid columns selected')
  }

  const saved = await setReleaseSubmissionExportColumns(supabase, columns)
  return NextResponse.json({
    columns: resolveExportColumns(saved, available),
    defaults: DEFAULT_EXPORT_COLUMNS,
    available,
  })
})
