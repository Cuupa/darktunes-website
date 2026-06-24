/**
 * AES-256-GCM encryption for api_credentials values.
 * Ciphertext envelope: v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENVELOPE_VERSION = 'v1'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function parseEncryptionKey(hexKey: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error(
      'API_CREDENTIALS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32',
    )
  }
  return Buffer.from(hexKey, 'hex')
}

export function getEncryptionKeyFromEnv(): Buffer {
  const hexKey = process.env.API_CREDENTIALS_ENCRYPTION_KEY
  if (!hexKey) {
    throw new Error('API_CREDENTIALS_ENCRYPTION_KEY is not configured')
  }
  return parseEncryptionKey(hexKey)
}

export function encryptCredential(plaintext: string, key?: Buffer): string {
  const encryptionKey = key ?? getEncryptionKeyFromEnv()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    ENVELOPE_VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decryptCredential(ciphertext: string, key?: Buffer): string {
  if (!ciphertext) return ''

  const parts = ciphertext.split(':')
  if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) {
    throw new Error('Invalid credential ciphertext envelope')
  }

  const [, ivB64, authTagB64, dataB64] = parts
  const encryptionKey = key ?? getEncryptionKeyFromEnv()
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const encrypted = Buffer.from(dataB64, 'base64')

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid credential IV length')
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid credential auth tag length')
  }

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function isEncryptedCredentialEnvelope(value: string): boolean {
  return value.trim().startsWith(`${ENVELOPE_VERSION}:`)
}

export function maskCredentialValue(value: string): string {
  if (!value) return ''
  if (value.length <= 4) return '••••'
  return `••••••••${value.slice(-4)}`
}