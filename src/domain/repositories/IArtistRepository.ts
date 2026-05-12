/**
 * src/domain/repositories/IArtistRepository.ts
 *
 * Repository interface for the Artist aggregate.
 *
 * This interface lives in the domain layer and expresses what the application
 * needs from persistent storage without depending on any specific
 * infrastructure (Supabase, REST, mock, etc.).
 *
 * Concrete implementations live in src/lib/api/artists.ts (Supabase) and
 * test doubles live alongside their respective test files.
 *
 * Dependency Inversion Principle: application-layer use-cases depend on this
 * interface, not on the concrete Supabase DAL, making them independently
 * testable and swappable.
 */

import type { Artist } from '@/types'

export interface ArtistFilters {
  /** When true, return only artists where is_visible = TRUE. */
  visibleOnly?: boolean
  /** Limit the number of results. */
  limit?: number
}

export interface IArtistRepository {
  /** Return all artists, optionally filtered. */
  findAll(filters?: ArtistFilters): Promise<Artist[]>

  /** Return a single artist by its UUID. Returns null when not found. */
  findById(id: string): Promise<Artist | null>

  /** Return a single artist by its URL-friendly slug. Returns null when not found. */
  findBySlug(slug: string): Promise<Artist | null>

  /**
   * Return the artist linked to the given Supabase auth user ID.
   * Used by the Artist Portal to resolve the current user's artist profile.
   */
  findByUserId(userId: string): Promise<Artist | null>

  /** Persist a new artist and return the created record. */
  create(data: Omit<Artist, 'id'>): Promise<Artist>

  /** Update an existing artist (partial update). Returns the updated record. */
  update(id: string, data: Partial<Omit<Artist, 'id'>>): Promise<Artist>

  /** Delete an artist by ID. */
  delete(id: string): Promise<void>
}
