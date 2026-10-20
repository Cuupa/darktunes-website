import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { attachAssetsToSubmission, clearExpiredSubmissionPointer } from './releaseSubmissionAssets'

type DbClient = SupabaseClient<Database>

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

describe('clearExpiredSubmissionPointer', () => {
  it('only clears the submission column when it still holds this key', async () => {
    const builder = makeBuilder(null)
    const db = { from: vi.fn().mockReturnValue(builder) } as unknown as DbClient
    await clearExpiredSubmissionPointer(db, {
      kind: 'audio',
      r2Key: 'release-submissions/a/old.wav',
      submissionId: 'sub-1',
    })
    expect(db.from).toHaveBeenCalledWith('release_submissions')
    expect(builder.update).toHaveBeenCalledWith({ audio_r2_key: null, audio_download_url: '' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'sub-1')
    expect(builder.eq).toHaveBeenCalledWith('audio_r2_key', 'release-submissions/a/old.wav')
  })

  it('does nothing when the asset is not attached', async () => {
    const db = { from: vi.fn() } as unknown as DbClient
    await clearExpiredSubmissionPointer(db, {
      kind: 'cover',
      r2Key: 'k',
      submissionId: null,
    })
    expect(db.from).not.toHaveBeenCalled()
  })
})

describe('attachAssetsToSubmission', () => {
  it('refreshes expires_at on attach', async () => {
    const builder = makeBuilder(null)
    const db = { from: vi.fn().mockReturnValue(builder) } as unknown as DbClient
    await attachAssetsToSubmission(db, 'artist-1', 'sub-1', ['k1'], '2026-11-20T00:00:00.000Z')
    expect(builder.update).toHaveBeenCalledWith({
      submission_id: 'sub-1',
      expires_at: '2026-11-20T00:00:00.000Z',
    })
    expect(builder.in).toHaveBeenCalledWith('r2_key', ['k1'])
  })
})
