import { describe, expect, it } from 'vitest'
import { shouldPreventLenis } from '@/lib/scroll/lenisPrevent'

describe('shouldPreventLenis', () => {
  it('returns true inside data-lenis-prevent', () => {
    document.body.innerHTML = `
      <div id="panel" data-lenis-prevent>
        <span id="target">x</span>
      </div>
    `
    const target = document.getElementById('target')!
    expect(shouldPreventLenis(target)).toBe(true)
  })

  it('returns true inside scroll-area viewport', () => {
    document.body.innerHTML = `
      <div data-slot="scroll-area-viewport">
        <span id="target">x</span>
      </div>
    `
    const target = document.getElementById('target')!
    expect(shouldPreventLenis(target)).toBe(true)
  })

  it('returns true inside overflow-y-auto container', () => {
    document.body.innerHTML = `
      <div class="overflow-y-auto">
        <span id="target">x</span>
      </div>
    `
    const target = document.getElementById('target')!
    expect(shouldPreventLenis(target)).toBe(true)
  })

  it('returns false for plain content', () => {
    document.body.innerHTML = `<p id="target">hello</p>`
    const target = document.getElementById('target')!
    expect(shouldPreventLenis(target)).toBe(false)
  })
})