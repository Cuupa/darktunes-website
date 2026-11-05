import { describe, expect, it } from 'vitest'
import { createWorkspaceSaveQueue } from './workspaceSaveQueue'

describe('workspace save serialization', () => {
  it('waits for the server revision before starting a second save', async () => {
    const queue = createWorkspaceSaveQueue()
    let release: () => void = () => {}
    const pending = new Promise<void>((resolve) => { release = resolve })
    let revision = 3
    const revisions: number[] = []
    const first = queue(async () => { revisions.push(revision); await pending; revision = 4; return true })
    const second = queue(async () => { revisions.push(revision); return true })
    await Promise.resolve()
    expect(revisions).toEqual([3])
    release()
    await Promise.all([first, second])
    expect(revisions).toEqual([3, 4])
  })
  it('does not strand future saves after a network failure', async () => {
    const queue = createWorkspaceSaveQueue()
    await expect(queue(async () => { throw new Error('network') })).rejects.toThrow('network')
    await expect(queue(async () => true)).resolves.toBe(true)
  })
})
