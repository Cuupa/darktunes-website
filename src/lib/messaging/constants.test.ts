import { describe, it, expect } from 'vitest'
import {
  MESSAGE_LIST_MAX_LIMIT,
  resolveMessageListLimit,
  resolveMessageListOffset,
} from './constants'
import { assertMessageAttachmentAllowed, isAllowedAttachmentUrl } from './attachments'
import { evaluateRules } from '@/lib/api/messageRules'
import type { LabelMessage, MessageRule } from '@/types'

describe('message list pagination helpers', () => {
  it('clamps limit to max', () => {
    expect(resolveMessageListLimit(9999)).toBe(MESSAGE_LIST_MAX_LIMIT)
  })

  it('uses default for invalid limit', () => {
    expect(resolveMessageListLimit(0)).toBe(50)
    expect(resolveMessageListLimit(undefined)).toBe(50)
  })

  it('floors offset at 0', () => {
    expect(resolveMessageListOffset(-3)).toBe(0)
    expect(resolveMessageListOffset(10)).toBe(10)
  })
})

describe('attachment validation', () => {
  it('accepts pdf within size', () => {
    expect(() =>
      assertMessageAttachmentAllowed({
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        filename: 'contract.pdf',
      }),
    ).not.toThrow()
  })

  it('rejects huge files', () => {
    expect(() =>
      assertMessageAttachmentAllowed({
        mimeType: 'application/pdf',
        sizeBytes: 50 * 1024 * 1024,
        filename: 'big.pdf',
      }),
    ).toThrow(/too large/i)
  })

  it('allows r2.dev URLs', () => {
    expect(isAllowedAttachmentUrl('https://pub-abc.r2.dev/msg/a.pdf')).toBe(true)
    expect(isAllowedAttachmentUrl('http://evil.com/x')).toBe(false)
    expect(isAllowedAttachmentUrl('/api/files/x')).toBe(true)
  })
})

describe('evaluateRules', () => {
  const message: LabelMessage = {
    id: 'm1',
    artistId: 'artist-1',
    subject: 'Urgent statement issue',
    body: 'Please check invoice',
    read: false,
    sentAt: '2026-01-01T00:00:00Z',
  }

  it('matches contains subject and returns first active rule', () => {
    const rules: MessageRule[] = [
      {
        id: 'r1',
        name: 'Star urgent',
        conditionField: 'subject',
        conditionOperator: 'contains',
        conditionValue: 'urgent',
        actionType: 'star',
        active: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]
    const hit = evaluateRules(rules, message)
    expect(hit?.id).toBe('r1')
  })

  it('skips inactive rules', () => {
    const rules: MessageRule[] = [
      {
        id: 'r1',
        name: 'Inactive',
        conditionField: 'subject',
        conditionOperator: 'contains',
        conditionValue: 'urgent',
        actionType: 'delete',
        active: false,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]
    expect(evaluateRules(rules, message)).toBeNull()
  })
})
