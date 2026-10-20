import { createHash } from 'crypto'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createR2Client, resetR2UploadConcurrencyForTests, uploadUrlToR2 } from './r2Utils'

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

function signedHeadersFromUrl(url: string): string {
  return decodeURIComponent(new URL(url).searchParams.get('X-Amz-SignedHeaders') ?? '')
}

describe('createR2Client presign', () => {
  it('does not sign flexible checksum headers that a browser PUT cannot send', async () => {
    const s3 = createR2Client('accountid', 'AKIAIOSFODNN7EXAMPLE', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    const { PutObjectCommand, UploadPartCommand } = await import('@aws-sdk/client-s3')

    const putUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: 'bucket',
        Key: 'sos-imports/batch/file.csv',
        ContentType: 'text/csv; charset=utf-8',
      }),
      { expiresIn: 900 },
    )
    const partUrl = await getSignedUrl(
      s3,
      new UploadPartCommand({
        Bucket: 'bucket',
        Key: 'sos-imports/batch/file.csv',
        UploadId: 'upload-id',
        PartNumber: 1,
      }),
      { expiresIn: 900 },
    )

    const putParams = [...new URL(putUrl).searchParams.keys()]
    const partParams = [...new URL(partUrl).searchParams.keys()]
    const putSigned = signedHeadersFromUrl(putUrl)
    const partSigned = signedHeadersFromUrl(partUrl)
    expect(putSigned).not.toMatch(/checksum/i)
    expect(partSigned).not.toMatch(/checksum/i)
    expect(putParams).not.toContain('x-amz-checksum-crc32')
    expect(putParams).not.toContain('x-amz-sdk-checksum-algorithm')
    expect(partParams).not.toContain('x-amz-checksum-crc32')
    expect(partParams).not.toContain('x-amz-sdk-checksum-algorithm')
  })
})