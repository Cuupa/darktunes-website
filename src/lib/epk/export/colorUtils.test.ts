import { describe, expect, it } from 'vitest'
import { rgb } from 'pdf-lib'
import { parseColorOpacity, parseColorToRgb } from './colorUtils'

describe('parseColorToRgb', () => {
  it('parses hex and functional rgb colors', () => {
    const fallback = rgb(0, 0, 0)
    expect(parseColorToRgb('#493687', fallback).red).toBeCloseTo(0.286, 2)
    expect(parseColorToRgb('rgb(255, 128, 0)', fallback).red).toBeCloseTo(1, 2)
    expect(parseColorToRgb('rgba(255, 128, 0, 0.5)', fallback).green).toBeCloseTo(0.5, 2)
  })
})

describe('parseColorOpacity', () => {
  it('extracts alpha from rgba and 8-digit hex', () => {
    expect(parseColorOpacity('rgba(0, 0, 0, 0.25)')).toBeCloseTo(0.25, 2)
    expect(parseColorOpacity('#49368780')).toBeCloseTo(0.5, 1)
    expect(parseColorOpacity('#493687')).toBe(1)
  })
})