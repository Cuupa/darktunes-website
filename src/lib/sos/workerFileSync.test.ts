import { describe, expect, it } from 'vitest'
import { fileParseFingerprint, planCsvWorkerFileSync } from './workerFileSync'

describe('planCsvWorkerFileSync', () => {
  it('queues new files', () => {
    const plan = planCsvWorkerFileSync([{ id: 'a', data: 'hello' }], new Map())
    expect(plan.toAdd).toEqual(['a'])
    expect(plan.toRemove).toEqual([])
  })

  it('removes files that left the session', () => {
    const plan = planCsvWorkerFileSync([], new Map([['a', fileParseFingerprint('a', 'hello')]]))
    expect(plan.toRemove).toEqual(['a'])
    expect(plan.toAdd).toEqual([])
  })

  it('re-parses a replaced file with the same id', () => {
    const sent = new Map([['a', fileParseFingerprint('a', 'old-csv')]])
    const plan = planCsvWorkerFileSync([{ id: 'a', data: 'new-csv-contents' }], sent)
    expect(plan.toRemove).toEqual(['a'])
    expect(plan.toAdd).toEqual(['a'])
  })

  it('skips unchanged files', () => {
    const data = 'same-csv'
    const sent = new Map([['a', fileParseFingerprint('a', data)]])
    const plan = planCsvWorkerFileSync([{ id: 'a', data }], sent)
    expect(plan.toRemove).toEqual([])
    expect(plan.toAdd).toEqual([])
  })

  it('ignores files that have no data yet', () => {
    const plan = planCsvWorkerFileSync([{ id: 'a' }, { id: 'b', data: '' }], new Map())
    expect(plan.toAdd).toEqual([])
    expect(plan.toRemove).toEqual([])
  })

  it('re-parses when length is the same but content changed', () => {
    const sent = new Map([['a', fileParseFingerprint('a', 'AAAA')]])
    const plan = planCsvWorkerFileSync([{ id: 'a', data: 'BBBB' }], sent)
    expect(plan.toRemove).toEqual(['a'])
    expect(plan.toAdd).toEqual(['a'])
  })

  it('adds, removes, and replaces in one pass', () => {
    const sent = new Map([
      ['keep', fileParseFingerprint('keep', 'same')],
      ['gone', fileParseFingerprint('gone', 'old')],
      ['swap', fileParseFingerprint('swap', 'before')],
    ])
    const plan = planCsvWorkerFileSync(
      [
        { id: 'keep', data: 'same' },
        { id: 'swap', data: 'after' },
        { id: 'new', data: 'fresh' },
      ],
      sent,
    )
    expect(plan.toRemove.sort()).toEqual(['gone', 'swap'])
    expect(plan.toAdd.sort()).toEqual(['new', 'swap'])
  })
})

describe('fileParseFingerprint', () => {
  it('is stable for the same id and data', () => {
    expect(fileParseFingerprint('a', 'hello')).toBe(fileParseFingerprint('a', 'hello'))
  })

  it('changes when data or id changes', () => {
    expect(fileParseFingerprint('a', 'hello')).not.toBe(fileParseFingerprint('a', 'hello!'))
    expect(fileParseFingerprint('a', 'hello')).not.toBe(fileParseFingerprint('b', 'hello'))
  })
})

