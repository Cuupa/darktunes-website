import { createHash } from 'crypto'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { resetR2UploadConcurrencyForTests, uploadUrlToR2 } from './r2Utils'

const IMAGE_BYTES = new Uint8Array([1, 2, 3])
const EXPECTED_HASH = createHash('sha256').update(Buffer.from(IMAGE_BYTES)).digest('hex')

describe('uploadUrlToR2', () => {
  beforeEach(() => {
    resetR2UploadConcurrencyForTests()
  })

  it('uploads with immutable cache-control header and hash-based key', async () => {
    const send = vi.fn().mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        const err = new Error('NotFound')
        err.name = 'NotFound'
        throw err
      }
      return {}
    })
    const s3 = { send } as unknown as S3Client
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(IMAGE_BYTES, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    ) as unknown as typeof fetch

    const url = await uploadUrlToR2(
      'https://example.com/image.png',
      s3,
      'bucket',
      'https://cdn.example.com',
      'cover-art',
      fetchFn,
    )

    expect(url).toBe(`https://cdn.example.com/cover-art/${EXPECTED_HASH}.png`)
    expect(send).toHaveBeenCalledTimes(2)
    const putCommand = send.mock.calls.find(([cmd]) => cmd instanceof PutObjectCommand)?.[0] as PutObjectCommand
    expect(putCommand.input.Key).toBe(`cover-art/${EXPECTED_HASH}.png`)
    expect(putCommand.input.CacheControl).toBe('public, max-age=31536000, immutable')
  })

  it('skips upload when object already exists in R2', async () => {
    const send = vi.fn().mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) return {}
      throw new Error('PutObject should not be called')
    })
    const s3 = { send } as unknown as S3Client
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(IMAGE_BYTES, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    ) as unknown as typeof fetch

    const url = await uploadUrlToR2(
      'https://example.com/image.png',
      s3,
      'bucket',
      'https://cdn.example.com',
      'cover-art',
      fetchFn,
    )

    expect(url).toBe(`https://cdn.example.com/cover-art/${EXPECTED_HASH}.png`)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand)
  })

  it('retries transient DNS errors on R2 put then succeeds', async () => {
    let putAttempts = 0
    const send = vi.fn().mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        const err = new Error('NotFound')
        err.name = 'NotFound'
        throw err
      }
      putAttempts += 1
      if (putAttempts === 1) {
        throw new Error('getaddrinfo EBUSY darktunes-assets.r2.cloudflarestorage.com')
      }
      return {}
    })
    const s3 = { send } as unknown as S3Client
    const fetchFn = vi.fn().mockImplementation(
      async () =>
        new Response(IMAGE_BYTES, {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
    ) as unknown as typeof fetch

    const url = await uploadUrlToR2(
      'https://example.com/image.png',
      s3,
      'bucket',
      'https://cdn.example.com',
      'cover-art',
      fetchFn,
    )

    expect(url).toBe(`https://cdn.example.com/cover-art/${EXPECTED_HASH}.png`)
    expect(putAttempts).toBe(2)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})