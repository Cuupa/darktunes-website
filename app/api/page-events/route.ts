import { NextRequest, NextResponse } from 'next/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp } from '@/lib/ipRateLimit'
import { hashSessionForPageEvents } from '@/lib/analytics/sessionHash'
import { logPageEvent, type PageEventType } from '@/lib/api/pageEvents'

const VALID_EVENT_TYPES = new Set<PageEventType>([
  'page_view',
  'shop_click',
  'smart_link_click',
  'news_view',
])

const ARTIST_PATH_RE = /^\/artists\/([^/]+)\/?$/
const NEWS_PATH_RE = /^\/news\/([^/]+)\/?$/

interface PageEventPayload {
  eventType: PageEventType
  path: string
  artistId?: string | null
  sessionId?: string | null
  referrerHost?: string | null
}

function isPageEventPayload(value: unknown): value is PageEventPayload {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Partial<PageEventPayload>
  return (
    typeof payload.eventType === 'string' &&
    VALID_EVENT_TYPES.has(payload.eventType as PageEventType) &&
    typeof payload.path === 'string' &&
    payload.path.length > 0 &&
    payload.path.length <= 500
  )
}

function normalisePath(path: string): string {
  const withoutQuery = path.split('?')[0] ?? path
  return withoutQuery.length > 500 ? withoutQuery.slice(0, 500) : withoutQuery
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  const ip = getClientIp(request)
  const { limited } = checkRateLimit(`page-events:${ip}`, 120, 10 * 60_000)
  if (limited) throw new ApiError(429, 'Too many requests')

  const rawBody = await request.text()
  if (!rawBody) throw new ApiError(400, 'Empty body')

  let body: unknown
  try {
    body = JSON.parse(rawBody) as unknown
  } catch {
    throw new ApiError(400, 'Invalid JSON')
  }

  if (!isPageEventPayload(body)) {
    throw new ApiError(400, 'Invalid page event payload')
  }

  const path = normalisePath(body.path)
  const supabase = await createServiceRoleSupabaseClient()

  let artistId: string | null = body.artistId ?? null
  let newsPostId: string | null = null

  const artistMatch = path.match(ARTIST_PATH_RE)
  if (artistMatch?.[1]) {
    const { data } = await supabase
      .from('artists')
      .select('id')
      .eq('slug', artistMatch[1])
      .maybeSingle()
    artistId = data?.id ?? artistId
  }

  const newsMatch = path.match(NEWS_PATH_RE)
  if (newsMatch?.[1]) {
    const { data } = await supabase
      .from('news_posts')
      .select('id, artist_id')
      .eq('slug', newsMatch[1])
      .maybeSingle()
    newsPostId = data?.id ?? null
    if (!artistId && data?.artist_id) artistId = data.artist_id
  }

  const sessionHash =
    body.sessionId && body.sessionId.length > 0
      ? hashSessionForPageEvents(ip, body.sessionId)
      : null

  await logPageEvent(supabase, {
    eventType: body.eventType,
    path,
    artistId,
    newsPostId,
    referrerHost: body.referrerHost ?? null,
    sessionHash,
  })

  return NextResponse.json({ ok: true })
})