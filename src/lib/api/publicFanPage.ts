/**
 * Public Fan Page reads — published pages only (RLS enforced).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  parseLandingPageDocumentV1,
  type LandingPageDocumentV1,
} from '@/lib/fan-page/schema/documentV1'

type DbClient = SupabaseClient<Database>

export interface PublicFanPage {
  artistId: string
  artistSlug: string
  artistName: string
  document: LandingPageDocumentV1
  seoTitle: string | null
  seoDescription: string | null
  publishedAt: string | null
}

export async function getPublishedFanPageBySlug(
  db: DbClient,
  slug: string,
): Promise<PublicFanPage | null> {
  const { data: artist, error: artistError } = await db
    .from('artists')
    .select('id, slug, name, is_visible')
    .eq('slug', slug)
    .maybeSingle()

  if (artistError) throw new Error(artistError.message)
  if (!artist || !artist.is_visible) return null

  const { data: page, error: pageError } = await db
    .from('artist_landing_pages')
    .select('document, seo_title, seo_description, published_at, publish_status')
    .eq('artist_id', artist.id)
    .eq('publish_status', 'published')
    .maybeSingle()

  if (pageError) throw new Error(pageError.message)
  if (!page?.document) return null

  return {
    artistId: artist.id,
    artistSlug: artist.slug,
    artistName: artist.name,
    document: parseLandingPageDocumentV1(page.document),
    seoTitle: page.seo_title,
    seoDescription: page.seo_description,
    publishedAt: page.published_at,
  }
}