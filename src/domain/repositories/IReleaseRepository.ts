/**
 * src/domain/repositories/IReleaseRepository.ts
 *
 * Repository interface for the Release aggregate.
 */

import type { Release } from '@/types'

export interface ReleaseFilters {
  /** Filter by artist ID. */
  artistId?: string
  /** When true, return only releases where is_visible = TRUE. */
  visibleOnly?: boolean
  /** Limit the number of results. */
  limit?: number
}

export interface IReleaseRepository {
  /** Return all releases, optionally filtered. */
  findAll(filters?: ReleaseFilters): Promise<Release[]>

  /** Return a single release by its UUID. Returns null when not found. */
  findById(id: string): Promise<Release | null>

  /** Return all releases for a given artist. */
  findByArtistId(artistId: string, visibleOnly?: boolean): Promise<Release[]>

  /** Persist a new release and return the created record. */
  create(data: Omit<Release, 'id'>): Promise<Release>

  /** Update an existing release (partial update). Returns the updated record. */
  update(id: string, data: Partial<Omit<Release, 'id'>>): Promise<Release>

  /** Delete a release by ID. */
  delete(id: string): Promise<void>

  /** Delete all releases with no linked artist (artist_id IS NULL). */
  deleteOrphaned(): Promise<number>
}
