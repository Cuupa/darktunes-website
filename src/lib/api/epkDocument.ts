/**
 * src/lib/api/epkDocument.ts
 *
 * DAL for EPK Canvas document persistence on artist_epks.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Artist } from '@/types'
import type { ArtistProfile } from './artistProfiles'
import type { EpkDocumentV2, EpkEditorMode } from '@/lib/epk/schema/documentV2'
import { parseEpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { legacyToDocumentV2 } from '@/lib/epk/migrate/legacyToDocumentV2'
import { createEpkVersion, getEpkVersionById } from './epkVersions'

type DbClient = SupabaseClient<Database>

export interface EpkDocumentState {
  document: EpkDocumentV2
  documentVersion: number
  editorMode: EpkEditorMode
}

export async function getEpkDocumentState(
  db: DbClient,
  artistId: string,
  profile: ArtistProfile,
  artist: Artist,
  labelName?: string,
): Promise<EpkDocumentState> {
  const row = await db
    .from('artist_epks')
    .select('epk_document, epk_document_version, epk_editor_mode')
    .eq('artist_id', artistId)
    .maybeSingle()

  if (row.error) throw new Error(row.error.message)

  if (row.data?.epk_document) {
    const document = parseEpkDocumentV2(row.data.epk_document)
    return {
      document,
      documentVersion: row.data.epk_document_version ?? 1,
      editorMode: (row.data.epk_editor_mode as EpkEditorMode) ?? 'canvas',
    }
  }

  const migrated = legacyToDocumentV2({ profile, artist, labelName })
  return {
    document: migrated,
    documentVersion: 1,
    editorMode: 'legacy',
  }
}

export async function saveEpkDocument(
  db: DbClient,
  artistId: string,
  document: EpkDocumentV2,
  userId: string,
  options?: { createVersion?: boolean; versionLabel?: string },
): Promise<EpkDocumentState> {
  const parsed = parseEpkDocumentV2(document)

  const current = await db
    .from('artist_epks')
    .select('epk_document_version')
    .eq('artist_id', artistId)
    .maybeSingle()

  if (current.error) throw new Error(current.error.message)

  const nextVersion = (current.data?.epk_document_version ?? 0) + 1

  const { error } = await db
    .from('artist_epks')
    .upsert(
      {
        artist_id: artistId,
        epk_document: parsed as unknown as Record<string, unknown>,
        epk_document_version: nextVersion,
        epk_editor_mode: 'canvas',
      },
      { onConflict: 'artist_id' },
    )

  if (error) throw new Error(error.message)

  if (options?.createVersion) {
    await createEpkVersion(db, {
      artistId,
      document: parsed,
      versionNumber: nextVersion,
      createdBy: userId,
      label: options.versionLabel,
    })
  }

  return {
    document: parsed,
    documentVersion: nextVersion,
    editorMode: 'canvas',
  }
}

export async function ensureMigratedEpkDocument(
  db: DbClient,
  artistId: string,
  profile: ArtistProfile,
  artist: Artist,
  labelName?: string,
): Promise<EpkDocumentState> {
  const row = await db
    .from('artist_epks')
    .select('epk_document, epk_document_version, epk_editor_mode')
    .eq('artist_id', artistId)
    .maybeSingle()

  if (row.error) throw new Error(row.error.message)

  if (row.data?.epk_document) {
    return {
      document: parseEpkDocumentV2(row.data.epk_document),
      documentVersion: row.data.epk_document_version ?? 1,
      editorMode: (row.data.epk_editor_mode as EpkEditorMode) ?? 'canvas',
    }
  }

  const migrated = legacyToDocumentV2({ profile, artist, labelName })
  const { error } = await db
    .from('artist_epks')
    .upsert(
      {
        artist_id: artistId,
        epk_document: migrated as unknown as Record<string, unknown>,
        epk_document_version: 1,
        epk_editor_mode: 'legacy',
      },
      { onConflict: 'artist_id' },
    )

  if (error) throw new Error(error.message)

  return {
    document: migrated,
    documentVersion: 1,
    editorMode: 'legacy',
  }
}

export async function restoreEpkVersion(
  db: DbClient,
  artistId: string,
  versionId: string,
  userId: string,
): Promise<EpkDocumentState> {
  const version = await getEpkVersionById(db, artistId, versionId)
  if (!version) throw new Error('EPK version not found')

  return saveEpkDocument(db, artistId, version.document, userId, {
    createVersion: true,
    versionLabel: `Restored from v${version.versionNumber}`,
  })
}