import { describe, expect, it, vi } from 'vitest'
import { applyLinkPopover } from '@/components/admin/tiptap/LinkPopover'

function createMockEditor(overrides: {
  isActiveLink?: boolean
  selectionEmpty?: boolean
  chainSteps?: string[]
} = {}) {
  const chainSteps: string[] = overrides.chainSteps ?? []
  const chain = {
    focus: vi.fn().mockReturnThis(),
    extendMarkRange: vi.fn().mockReturnThis(),
    unsetLink: vi.fn().mockReturnThis(),
    deleteSelection: vi.fn().mockReturnThis(),
    insertContent: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    run: vi.fn(() => {
      chainSteps.push('run')
      return true
    }),
  }

  const editor = {
    isActive: vi.fn((name: string) => name === 'link' && (overrides.isActiveLink ?? false)),
    chain: vi.fn(() => chain),
    state: {
      selection: {
        empty: overrides.selectionEmpty ?? true,
      },
    },
  }

  return { editor: editor as never, chain, chainSteps }
}

describe('applyLinkPopover', () => {
  it('removes the link when URL is empty', () => {
    const { editor, chain } = createMockEditor({ isActiveLink: true })

    applyLinkPopover({
      editor,
      url: '   ',
      linkText: 'HERE',
      newTab: true,
      linkColor: '',
    })

    expect(chain.extendMarkRange).toHaveBeenCalledWith('link')
    expect(chain.unsetLink).toHaveBeenCalled()
    expect(chain.insertContent).not.toHaveBeenCalled()
  })

  it('inserts linked display text at the cursor when nothing is selected', () => {
    const { editor, chain } = createMockEditor({ selectionEmpty: true })

    applyLinkPopover({
      editor,
      url: 'https://example.com',
      linkText: 'HERE',
      newTab: true,
      linkColor: '',
    })

    expect(chain.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: 'HERE',
      marks: [{
        type: 'link',
        attrs: {
          href: 'https://example.com',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }],
    })
    expect(chain.run).toHaveBeenCalled()
  })

  it('replaces an active link with new display text', () => {
    const { editor, chain } = createMockEditor({ isActiveLink: true })

    applyLinkPopover({
      editor,
      url: 'https://example.com/guide',
      linkText: 'HERE',
      newTab: false,
      linkColor: '',
    })

    expect(chain.extendMarkRange).toHaveBeenCalledWith('link')
    expect(chain.deleteSelection).toHaveBeenCalled()
    expect(chain.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: 'HERE',
      marks: [{
        type: 'link',
        attrs: {
          href: 'https://example.com/guide',
          target: '_self',
          rel: 'noopener noreferrer',
        },
      }],
    })
  })

  it('falls back to the URL as display text when link text is empty', () => {
    const { editor, chain } = createMockEditor({ selectionEmpty: true })

    applyLinkPopover({
      editor,
      url: 'https://example.com',
      linkText: '',
      newTab: true,
      linkColor: '',
    })

    expect(chain.insertContent).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'https://example.com' }),
    )
  })
})