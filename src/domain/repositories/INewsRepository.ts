/**
 * src/domain/repositories/INewsRepository.ts
 *
 * Repository interface for the NewsPost aggregate.
 */

import type { NewsPost } from '@/types'

export interface NewsFilters {
  /** When true, include press-only posts. Default: false (public view). */
  includePressOnly?: boolean
  /** Limit the number of results. */
  limit?: number
}

export interface INewsRepository {
  /** Return all news posts, optionally filtered. */
  findAll(filters?: NewsFilters): Promise<NewsPost[]>

  /** Return a single news post by its UUID. Returns null when not found. */
  findById(id: string): Promise<NewsPost | null>

  /** Return a single news post by its slug. Returns null when not found. */
  findBySlug(slug: string): Promise<NewsPost | null>

  /** Persist a new news post and return the created record. */
  create(data: Omit<NewsPost, 'id'>): Promise<NewsPost>

  /** Update an existing news post (partial update). Returns the updated record. */
  update(id: string, data: Partial<Omit<NewsPost, 'id'>>): Promise<NewsPost>

  /** Delete a news post by ID. */
  delete(id: string): Promise<void>
}
