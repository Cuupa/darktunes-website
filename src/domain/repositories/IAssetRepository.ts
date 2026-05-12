/**
 * src/domain/repositories/IAssetRepository.ts
 *
 * Repository interface for the Asset aggregate.
 */

import type { Asset } from '@/types'

export interface IAssetRepository {
  /** Return all assets. */
  findAll(): Promise<Asset[]>

  /** Return a single asset by its UUID. Returns null when not found. */
  findById(id: string): Promise<Asset | null>

  /** Persist a new asset record and return the created record. */
  create(data: Omit<Asset, 'id' | 'createdAt'>): Promise<Asset>

  /** Delete an asset record by ID. */
  delete(id: string): Promise<void>
}
