/**
 * src/lib/api/epkShareLinks.ts
 *
 * DAL for tokenized public EPK share links (epk_share_links table).
 */

import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { hashSharePassword } from '@/lib/epk/sharePassword'

type DbClient = SupabaseClient<Database>
type ShareLinkRow = Database['public']['Tables']['epk_share_links']['Row']

export interface EpkShareLink {
  id: string
  artistId: string
  token: string
  hasPassword: boolean
  expiresAt: string | undefined
  label: string | undefined
  createdBy: string | undefined
  createdAt: string
  revokedAt: string | undefined
}

export interface CreateEpkShareLinkInput {
  artistId: string
  createdBy: string
  label?: string
  password?: string
  expiresAt?: string
}

function rowToShareLink(row: ShareLinkRow): EpkShareLink {
  return {
    id: row.id,
    artistId: row.artist_id,
    token: row.token,
    hasPassword: Boolean(row.password_hash),
    expiresAt: row.expires_at ?? undefined,
    label: row.label ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    revokedAt: row.revoked_at ?? undefined,
  }
}

function generateShareToken(): string {
  return randomBytes(24).toString('base64url')
}

function isShareLinkActive(link: EpkShareLink): boolean {
  if (link.revokedAt) return false
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return false
  return true
}

export async function listEpkShareLinks(db: DbClient, artistId: string): Promise<EpkShareLink[]> {
  const { data, error } = await db
    .from('epk_share_links')
    .select('*')
    .eq('artist_id', artistId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((row) => rowToShareLink(row as ShareLinkRow))
    .filter(isShareLinkActive)
}

export async function createEpkShareLink(
  db: DbClient,
  input: CreateEpkShareLinkInput,
): Promise<EpkShareLink> {
  const { data, error } = await db
    .from('epk_share_links')
    .insert({
      artist_id: input.artistId,
      token: generateShareToken(),
      password_hash: input.password ? hashSharePassword(input.password) : null,
      expires_at: input.expiresAt ?? null,
      label: input.label ?? null,
      created_by: input.createdBy,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createEpkShareLink')
  return rowToShareLink(data as ShareLinkRow)
}

export async function revokeEpkShareLink(
  db: DbClient,
  artistId: string,
  linkId: string,
): Promise<void> {
  const { error } = await db
    .from('epk_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('artist_id', artistId)

  if (error) throw new Error(error.message)
}

export async function getEpkShareLinkByToken(
  db: DbClient,
  token: string,
): Promise<(EpkShareLink & { passwordHash: string | undefined }) | null> {
  const { data, error } = await db
    .from('epk_share_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as ShareLinkRow
  if (row.revoked_at) return null
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null

  return {
    ...rowToShareLink(row),
    passwordHash: row.password_hash ?? undefined,
  }
}