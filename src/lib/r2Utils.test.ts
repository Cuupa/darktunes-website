import { describe, it, expect, vi } from 'vitest'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { uploadUrlToR2 } from './r2Utils'

describe('uploadUrlToR2', () => {
  it('uploads with immutable cache-control header', async () => {
    const send = vi.fn().mockResolvedValue({})
    const s3 = { send } as unknown as S3Client
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    ) as unknown as typeof fetch

    await uploadUrlToR2(
      'https://example.com/image.png',
      s3,
      'bucket',
      'https://cdn.example.com',
      'cover-art',
      fetchFn,
    )

    expect(send).toHaveBeenCalledTimes(1)
    const command = send.mock.calls[0][0] as PutObjectCommand
    expect(command.input.CacheControl).toBe('public, max-age=31536000, immutable')
  })
})
