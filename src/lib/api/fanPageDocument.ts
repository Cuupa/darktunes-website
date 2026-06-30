/**
 * DAL for Fan Page document persistence on artist_landing_pages.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Artist } from '@/types'
import type { ArtistProfile } from './artistProfiles'
import {
  type LandingPageDocumentV1,
  type FanPagePublishStatus,
  parseLandingPageDocumentV1,
} from '@/lib/fan-page/schema/documentV1'
import { createTemplateDocument } from '@/lib/fan-page/templates/starterTemplates'
import { hydrateFanPageDocument } from '@/lib/fan-page/templates/hydrateArtistData'
import { toDbRecord } from '@/lib/types/jsonColumns'

type DbClient = SupabaseClient<Database>
type LandingRow = Database['public']['Tables']['artist_landing_pages']['Row']

export interface FanPageDocumentState {
  document: LandingPageDocumentV1
  documentVersion: number
  publishStatus: FanPagePublishStatus
  templateId: string | null
  seoTitle: string | null
  seoDescription: string | null
  reviewComment: string | null
}

function rowToState(row: LandingRow): FanPageDocumentState {
  const raw = row.document
  const document =
    raw && typeof raw === 'object' && Object.keys(raw).length > 0
      ? parseLandingPageDocumentV1(raw)
      : createTemplateDocument(row.template_id ?? 'dark-minimal')

  return {
    document,
    documentVersion: row.document_version,
    publishStatus: row.publish_status,
    templateId: row.template_id,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    reviewComment: row.review_comment,
  }
}

export async function getFanPageDocumentState(
  db: DbClient,
  artistId: string,
  artist: Artist,
  profile: ArtistProfile | null,
  templateId = 'dark-minimal',
): Promise<FanPageDocumentState> {
  const { data, error } = await db
    .from('artist_landing_pages')
    .select('*')
    .eq('artist_id', artistId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    const document = hydrateFanPageDocument(createTemplateDocument(templateId), artist, profile)
    return {
      document,
      documentVersion: 0,
      publishStatus: 'draft',
      templateId,
      seoTitle: null,
      seoDescription: null,
      reviewComment: null,
    }
  }

  const state = rowToState(data)
  return {
    ...state,
    document: hydrateFanPageDocument(state.document, artist, profile),
  }
}

export async function saveFanPageDocument(
  db: DbClient,
  artistId: string,
  document: LandingPageDocumentV1,
): Promise<FanPageDocumentState> {
  const parsed = parseLandingPageDocumentV1(document)

  const current = await db
    .from('artist_landing_pages')
    .select('document_version')
    .eq('artist_id', artistId)
    .maybeSingle()

  if (current.error) throw new Error(current.error.message)

  const nextVersion = (current.data?.document_version ?? 0) + 1

  const { data, error } = await db
    .from('artist_landing_pages')
    .upsert(
      {
        artist_id: artistId,
        document: toDbRecord(parsed),
        document_version: nextVersion,
        template_id: parsed.templateId,
      },
      { onConflict: 'artist_id' },
    )
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return rowToState(data)
}

export async function applyFanPageTemplate(
  db: DbClient,
  artistId: string,
  templateId: string,
  artist: Artist,
  profile: ArtistProfile | null,
): Promise<FanPageDocumentState> {
  const document = hydrateFanPageDocument(createTemplateDocument(templateId), artist, profile)
  return saveFanPageDocument(db, artistId, document)
}

export interface PublishFanPageInput {
  artistId: string
  mode: 'draft' | 'submit_review' | 'publish_direct'
  landingPublishTrusted: boolean
  userId: string
}

export async function publishFanPage(
  db: DbClient,
  input: PublishFanPageInput,
): Promise<FanPageDocumentState> {
  let publishStatus: FanPagePublishStatus = 'draft'
  let publishedAt: string | null = null

  if (input.mode === 'submit_review') {
    publishStatus = 'pending_review'
  } else if (input.mode === 'publish_direct') {
    if (!input.landingPublishTrusted) {
      throw new Error('Direct publish requires trusted artist status')
    }
    publishStatus = 'published'
    publishedAt = new Date().toISOString()
  }

  const { data, error } = await db
    .from('artist_landing_pages')
    .update({
      publish_status: publishStatus,
      published_at: publishedAt,
      review_comment: null,
    })
    .eq('artist_id', input.artistId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return rowToState(data)
}

export async function reviewFanPage(
  db: DbClient,
  artistId: string,
  approved: boolean,
  reviewerId: string,
  comment?: string,
): Promise<FanPageDocumentState> {
  const { data, error } = await db
    .from('artist_landing_pages')
    .update({
      publish_status: approved ? 'published' : 'rejected',
      published_at: approved ? new Date().toISOString() : null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_comment: comment ?? null,
    })
    .eq('artist_id', artistId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return rowToState(data)
}