import { describe, expect, it } from 'vitest'
import { describeDocumentChange } from '@/lib/fan-page/editor/historyLabels'
import type { LandingPageDocumentV1 } from '@/lib/fan-page/schema/documentV1'

function baseDocument(): LandingPageDocumentV1 {
  return {
    version: 1,
    templateId: 'dark-minimal',
    theme: { paletteId: 'dark-minimal' },
    sections: [],
  }
}

describe('describeDocumentChange', () => {
  it('detects added sections', () => {
    const before = baseDocument()
    const after = {
      ...before,
      sections: [
        {
          id: 's1',
          type: 'hero' as const,
          order: 0,
          props: {},
          styles: { desktop: {} },
        },
      ],
    }
    expect(describeDocumentChange(before, after)).toEqual({
      key: 'fanPage_history_added',
      blockKey: 'fanPage_block_hero',
    })
  })

  it('detects theme changes', () => {
    const before = baseDocument()
    const after = { ...before, theme: { paletteId: 'neon-pulse' } }
    expect(describeDocumentChange(before, after)).toEqual({ key: 'fanPage_history_theme' })
  })
})