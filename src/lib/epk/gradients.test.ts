import { describe, expect, it } from 'vitest'
import {
  gradientEndpoints,
  gradientToKonvaColorStops,
  gradientToSvg,
  normalizeGradientStops,
} from './gradients'

describe('gradients', () => {
  it('normalizes gradient stops', () => {
    const stops = normalizeGradientStops([
      { offset: 1, color: '#ffffff' },
      { offset: 0, color: '#101010' },
    ])
    expect(stops[0]?.offset).toBe(0)
    expect(stops[1]?.offset).toBe(1)
  })

  it('builds Konva color stop array', () => {
    expect(
      gradientToKonvaColorStops([
        { offset: 0, color: '#101010' },
        { offset: 1, color: '#493687' },
      ]),
    ).toEqual([0, '#101010', 1, '#493687'])
  })

  it('computes gradient endpoints', () => {
    const { start, end } = gradientEndpoints(800, 600, 0)
    expect(start.x).toBeLessThan(end.x)
  })

  it('renders SVG markup', () => {
    const svg = gradientToSvg(100, 50, {
      angle: 90,
      stops: [
        { offset: 0, color: '#101010' },
        { offset: 1, color: '#493687' },
      ],
    })
    expect(svg).toContain('<linearGradient')
    expect(svg).toContain('stop-color="#493687"')
  })
})