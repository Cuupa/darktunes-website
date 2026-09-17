/**
 * GET /api/admin/sos/settlement-audits
 *
 * Read-only audit of existing SOS accounting data (§E.3): missing/orphan period
 * links, artist mismatches, missing PDFs, unconfirmed batches, duplicates,
 * carry-forward and balance inconsistencies, missing evidence.
 * The scan never writes; findings are paginated with an opaque cursor.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdminFromRequest } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { AUDIT_CATEGORIES, type AuditCategory, type AuditFinding } from '@/lib/api/settlementAuditCore'
import {
  decodeAuditCursor,
  encodeAuditCursor,
  scanSettlementAudit,
} from '@/lib/api/settlementAudit'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_LIMIT
  if (!/^\d+$/.test(raw)) throw new ApiError(400, 'limit must be a positive integer')
  const value = Number(raw)
  if (value < 1 || value > MAX_LIMIT) {
    throw new ApiError(400, `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return value
}

function parseCategories(raw: string | null): AuditCategory[] | undefined {
  if (raw === null || raw.trim() === '') return undefined
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const unknown = values.filter(
    (value) => !(AUDIT_CATEGORIES as readonly string[]).includes(value),
  )
  if (unknown.length > 0) {
    throw new ApiError(400, `Unknown categories: ${unknown.join(', ')}`)
  }
  return values as AuditCategory[]
}

function findingToApi(finding: AuditFinding) {
  return {
    id: finding.id,
    category: finding.category,
    severity: finding.severity,
    entity_type: finding.entityType,
    entity_id: finding.entityId,
    summary: finding.summary,
    evidence: finding.evidence,
    expected_state: finding.expectedState,
    suggested_action: finding.suggestedAction,
    repairability: finding.repairability,
  }
}

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminFromRequest(req)

  const params = new URL(req.url).searchParams
  const periodId = params.get('period_id')
  if (periodId && !UUID_PATTERN.test(periodId)) {
    throw new ApiError(400, 'period_id must be a UUID')
  }

  const categories = parseCategories(params.get('categories'))
  const limit = parseLimit(params.get('limit'))

  const cursor = params.get('cursor')
  const afterId = cursor ? decodeAuditCursor(cursor) : null
  if (cursor && afterId === null) {
    throw new ApiError(400, 'cursor is invalid')
  }

  const db = await createServiceRoleSupabaseClient()
  const report = await scanSettlementAudit(db, { periodId, categories })

  let startIndex = 0
  if (afterId) {
    const cursorIndex = report.findings.findIndex((finding) => finding.id === afterId)
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0
  }

  const page = report.findings.slice(startIndex, startIndex + limit)
  const hasMore = startIndex + limit < report.findings.length
  const nextCursor =
    hasMore && page.length > 0 ? encodeAuditCursor(page[page.length - 1].id) : null

  return NextResponse.json({
    generated_at: report.generatedAt,
    scope: { period_id: report.scope.periodId },
    truncated: report.truncated,
    summary: {
      findings: report.summary.findings,
      by_category: report.summary.byCategory,
      by_severity: report.summary.bySeverity,
      by_repairability: report.summary.byRepairability,
    },
    findings: page.map(findingToApi),
    next_cursor: nextCursor,
  })
})
