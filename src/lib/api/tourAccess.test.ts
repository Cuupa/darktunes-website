import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { ApiError } from '@/lib/errors'

vi.mock('@/lib/api/tours', () => ({
  getTourById: vi.fn(),
}))

vi.mock('@/lib/api/tourCollaborators', () => ({
  getTourCollaborators: vi.fn(),
}))

import { getTourById } from '@/lib/api/tours'
import { getTourCollaborators } from '@/lib/api/tourCollaborators'
import {
  assertTourAccess,
  assertTourOwner,
  assertValidPerformingArtists,
  getTourRosterArtistIds,
} from '@/lib/api/tourAccess'

const mockGetTourById = vi.mocked(getTourById)
const mockGetTourCollaborators = vi.mocked(getTourCollaborators)

const baseTour = {
  id: 'tour-1',
  artistId: 'owner-1',
  name: 'Tour',
  description: null,
  startDate: null,
  endDate: null,
  archived: false,
  sortOrder: 0,
  settings: {} as import('@/lib/tour-planner/types').TourPlannerSettings,
  routeCache: null,
  budget: null,
  techDocuments: [],
  currency: 'EUR',
  totalBudget: null,
  createdBy: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

function dbWithCollaborator(collabId: string | null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: collabId ? { artist_id: collabId } : null,
        error: null,
      }),
    })),
  } as unknown as SupabaseClient<Database>
}

describe('tourAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTourById.mockResolvedValue(baseTour)
    mockGetTourCollaborators.mockResolvedValue([
      { artistId: 'collab-1', artistName: 'Collab', artistSlug: 'collab', invitedBy: null, createdAt: '2026-01-01' },
    ])
  })

  it('grants owner access', async () => {
    const access = await assertTourAccess(dbWithCollaborator(null), 'tour-1', 'owner-1')
    expect(access.role).toBe('owner')
    expect(access.canManageCollaborators).toBe(true)
  })

  it('grants collaborator access', async () => {
    const access = await assertTourAccess(dbWithCollaborator('collab-1'), 'tour-1', 'collab-1')
    expect(access.role).toBe('collaborator')
  })

  it('denies unknown artist', async () => {
    await expect(assertTourAccess(dbWithCollaborator(null), 'tour-1', 'stranger')).rejects.toThrow(ApiError)
  })

  it('requires owner for destructive actions', async () => {
    await expect(assertTourOwner(dbWithCollaborator('collab-1'), 'tour-1', 'collab-1')).rejects.toThrow(ApiError)
  })

  it('builds roster artist ids', async () => {
    const ids = await getTourRosterArtistIds(dbWithCollaborator(null), 'tour-1')
    expect(ids.has('owner-1')).toBe(true)
    expect(ids.has('collab-1')).toBe(true)
  })

  it('rejects invalid performing artists', async () => {
    await expect(assertValidPerformingArtists(dbWithCollaborator(null), 'tour-1', ['unknown'])).rejects.toThrow(ApiError)
  })
})