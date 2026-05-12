/**
 * src/domain/repositories/index.ts
 *
 * Re-exports all repository interfaces for convenient importing.
 *
 * Usage:
 *   import type { IArtistRepository, IReleaseRepository } from '@/domain/repositories'
 */

export type { IArtistRepository, ArtistFilters } from './IArtistRepository'
export type { IReleaseRepository, ReleaseFilters } from './IReleaseRepository'
export type { INewsRepository, NewsFilters } from './INewsRepository'
export type { IAssetRepository } from './IAssetRepository'
