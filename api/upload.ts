import type { VercelRequest, VercelResponse } from '@vercel/node'
import Busboy from 'busboy'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { extname } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? ''
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? ''
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? ''
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? ''
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL ?? ''

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
}

async function verifyToken(token: string): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase service key not configured')
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new Error('Unauthorized')
  return data.user.id
}

interface ParsedFile {
  buffer: Buffer
  filename: string
  mimeType: string
}

function parseMultipart(req: VercelRequest): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers })
    let resolved = false

    bb.on('file', (_field, stream, info) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => {
        resolved = true
        resolve({
          buffer: Buffer.concat(chunks),
          filename: info.filename,
          mimeType: info.mimeType,
        })
      })
      stream.on('error', reject)
    })

    bb.on('error', reject)
    bb.on('finish', () => {
      if (!resolved) reject(new Error('No file found in request'))
    })

    req.pipe(bb)
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }
  const token = authHeader.slice(7)

  try {
    await verifyToken(token)
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    res.status(500).json({ error: 'R2 storage is not configured' })
    return
  }

  let parsed: ParsedFile
  try {
    parsed = await parseMultipart(req)
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to parse upload' })
    return
  }

  const ext = extname(parsed.filename) || ''
  const r2Key = `uploads/${randomUUID()}${ext}`

  try {
    const r2 = getR2Client()
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: parsed.buffer,
        ContentType: parsed.mimeType,
        ContentLength: parsed.buffer.length,
      }),
    )
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload to R2 failed' })
    return
  }

  const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${r2Key}`

  res.status(200).json({
    publicUrl,
    r2Key,
    filename: r2Key.split('/').pop() ?? r2Key,
    mimeType: parsed.mimeType,
    sizeBytes: parsed.buffer.length,
  })
}
