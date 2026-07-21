import { beforeEach, describe, expect, it, vi } from 'vitest'

const { revalidateTag, revalidatePath } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag,
  revalidatePath,
}))

import {
  revalidatePublicContent,
  RELEASE_SYNC_TAGS,
  VIDEO_SYNC_TAGS,
} from './revalidatePublicContent'

describe('revalidatePublicContent', () => {
  beforeEach(() => {
    revalidateTag.mockClear()
    revalidatePath.mockClear()
  })

  it('revalidates release sync tags and related list paths', () => {
    revalidatePublicContent(RELEASE_SYNC_TAGS)

    expect(revalidateTag).toHaveBeenCalledWith('releases', 'max')
    expect(revalidateTag).toHaveBeenCalledWith('artists', 'max')
    expect(revalidateTag).toHaveBeenCalledWith('concerts', 'max')
    expect(revalidatePath).toHaveBeenCalledWith('/')
    expect(revalidatePath).toHaveBeenCalledWith('/releases')
    expect(revalidatePath).toHaveBeenCalledWith('/artists')
    expect(revalidatePath).toHaveBeenCalledWith('/events')
  })

  it('revalidates video tags without release paths', () => {
    revalidatePublicContent(VIDEO_SYNC_TAGS)

    expect(revalidateTag).toHaveBeenCalledWith('videos', 'max')
    expect(revalidatePath).toHaveBeenCalledWith('/')
    expect(revalidatePath).toHaveBeenCalledWith('/videos')
    expect(revalidatePath).not.toHaveBeenCalledWith('/releases')
  })

  it('dedupes shared paths when multiple tags map to home', () => {
    revalidatePublicContent(['releases', 'videos'])
    const homeCalls = revalidatePath.mock.calls.filter(([path]) => path === '/')
    expect(homeCalls).toHaveLength(1)
  })
})
