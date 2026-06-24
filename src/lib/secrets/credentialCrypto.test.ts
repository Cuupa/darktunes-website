import { describe, expect, it } from 'vitest'
import {
  decryptCredential,
  encryptCredential,
  isEncryptedCredentialEnvelope,
} from './credentialCrypto'

const TEST_KEY = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex')

describe('credentialCrypto', () => {
  it('round-trips plaintext through encrypt and decrypt', () => {
    const plaintext = 'super-secret-api-key-12345'
    const ciphertext = encryptCredential(plaintext, TEST_KEY)
    expect(ciphertext.startsWith('v1:')).toBe(true)
    expect(decryptCredential(ciphertext, TEST_KEY)).toBe(plaintext)
  })

  it('fails decrypt with wrong key', () => {
    const ciphertext = encryptCredential('token', TEST_KEY)
    const wrongKey = Buffer.alloc(32, 1)
    expect(() => decryptCredential(ciphertext, wrongKey)).toThrow()
  })

  it('detects encrypted envelope prefix', () => {
    const ciphertext = encryptCredential('token', TEST_KEY)
    expect(isEncryptedCredentialEnvelope(ciphertext)).toBe(true)
    expect(isEncryptedCredentialEnvelope('plain-text')).toBe(false)
  })

  it('fails decrypt when ciphertext is tampered', () => {
    const ciphertext = encryptCredential('token', TEST_KEY)
    const tampered = ciphertext.replace(/.$/, 'X')
    expect(() => decryptCredential(tampered, TEST_KEY)).toThrow()
  })
})