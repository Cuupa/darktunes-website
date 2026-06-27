import { describe, expect, it } from 'vitest'
import { parseTourPlannerJson, wasQueuedOffline } from '@/lib/tour-planner/clientApi'

describe('tourPlanner clientApi', () => {
  it('detects offline queued responses', () => {
    expect(wasQueuedOffline(new Response(null, { status: 202 }))).toBe(true)
    expect(wasQueuedOffline(new Response(null, { status: 200 }))).toBe(false)
  })

  it('parses successful JSON responses', async () => {
    const res = new Response(JSON.stringify({ tours: [] }), { status: 200 })
    const json = await parseTourPlannerJson<{ tours: unknown[] }>(res)
    expect(json.tours).toEqual([])
  })

  it('throws on failed responses', async () => {
    const res = new Response(null, { status: 500 })
    await expect(parseTourPlannerJson(res)).rejects.toThrow('Tour planner request failed (500)')
  })
})