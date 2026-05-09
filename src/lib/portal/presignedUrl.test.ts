import { describe, it, expect, vi } from 'vitest'
import { generatePresignedDownloadUrl, type PresignedUrlDeps } from './presignedUrl'

describe('generatePresignedDownloadUrl', () => {
  it('calls getSignedUrl with correct parameters and returns the URL', async () => {
    const fakeUrl = 'https://r2.cloudflarestorage.com/bucket/statements/key.pdf?X-Amz-Signature=abc'
    const mockGetSignedUrl = vi.fn().mockResolvedValue(fakeUrl)

    const deps: PresignedUrlDeps = {
      getSignedUrl: mockGetSignedUrl,
      s3Client: {} as never,
      bucket: 'darktunes-private',
    }

    const url = await generatePresignedDownloadUrl('statements/artist-uuid/key.pdf', deps)

    expect(url).toBe(fakeUrl)
    expect(mockGetSignedUrl).toHaveBeenCalledOnce()
  })

  it('returns a URL expiring in at most 300 seconds', async () => {
    let capturedExpiresIn: number | undefined
    const mockGetSignedUrl = vi.fn().mockImplementation(
      (_client: unknown, _cmd: unknown, opts: { expiresIn?: number }) => {
        capturedExpiresIn = opts?.expiresIn
        return Promise.resolve('https://example.com/presigned')
      },
    )

    const deps: PresignedUrlDeps = {
      getSignedUrl: mockGetSignedUrl,
      s3Client: {} as never,
      bucket: 'darktunes-private',
    }

    await generatePresignedDownloadUrl('statements/key.pdf', deps)

    expect(capturedExpiresIn).toBeDefined()
    expect(capturedExpiresIn).toBeLessThanOrEqual(300)
    expect(capturedExpiresIn).toBeGreaterThan(0)
  })

  it('propagates errors from getSignedUrl', async () => {
    const mockGetSignedUrl = vi.fn().mockRejectedValue(new Error('S3 error'))

    const deps: PresignedUrlDeps = {
      getSignedUrl: mockGetSignedUrl,
      s3Client: {} as never,
      bucket: 'darktunes-private',
    }

    await expect(generatePresignedDownloadUrl('statements/key.pdf', deps)).rejects.toThrow(
      'S3 error',
    )
  })
})
