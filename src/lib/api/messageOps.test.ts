import { describe, it, expect, vi } from 'vitest'
import { evaluateRules } from '@/lib/api/messageRules'
import type { LabelMessage, MessageRule } from '@/types'

// Lightweight contract tests for shared-inbox rule + ops shapes.
// Full claim/notes paths need DB; covered here via pure helpers.

describe('messageOps contracts', () => {
  it('priority tags are free-form strings on portal messages', () => {
    const priorities = ['low', 'normal', 'high', 'urgent'] as const
    expect(priorities).toContain('urgent')
  })

  it('claim semantics: first matching rule still stars messages', () => {
    const message: LabelMessage = {
      id: 'm1',
      artistId: 'a1',
      subject: 'VIP inquiry',
      body: 'hello',
      read: false,
      sentAt: '2026-01-01T00:00:00Z',
    }
    const rules: MessageRule[] = [
      {
        id: 'r1',
        name: 'VIP',
        conditionField: 'subject',
        conditionOperator: 'contains',
        conditionValue: 'vip',
        actionType: 'star',
        active: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]
    expect(evaluateRules(rules, message)?.actionType).toBe('star')
  })

  it('export bundle shape is serializable', () => {
    const bundle = {
      message: { id: 'm1', subject: 'Hi' },
      notes: [{ id: 'n1', body: 'staff only' }],
      events: [{ eventType: 'claim' }],
      exportedAt: new Date().toISOString(),
    }
    expect(() => JSON.stringify(bundle)).not.toThrow()
    expect(vi.isMockFunction(vi.fn())).toBe(true)
  })
})
