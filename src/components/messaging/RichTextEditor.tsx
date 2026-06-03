'use client'

import { useCallback, useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import {
  Code,
  Link as LinkIcon,
  ListBullets,
  ListNumbers,
  Quotes,
  TextB,
  TextH,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface RichTextEditorProps {
  value: string
  onChange: (html: string, text: string) => void
  disabled?: boolean
  placeholder?: string
  minHeight?: number
}

const HEADING_LEVELS = [1, 2, 3] as const

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder,
  minHeight = 180,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Underline,
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          'prose prose-invert max-w-none px-4 py-3 focus:outline-none whitespace-pre-wrap',
        'aria-label': 'Message body',
        'aria-multiline': 'true',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML(), currentEditor.getText())
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  const setLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', previousUrl ?? '')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }, [editor])

  if (!editor) return null

  const ToolbarButton = ({
    ariaLabel,
    active = false,
    children,
    onClick,
  }: {
    ariaLabel: string
    active?: boolean
    children: React.ReactNode
    onClick: () => void
  }) => (
    <Button
      type="button"
      variant={active ? 'default' : 'ghost'}
      size="icon"
      className="min-h-[44px] min-w-[44px]"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div role="toolbar" aria-label="Message formatting" className="flex flex-wrap gap-1 border-b border-border bg-muted/40 p-2">
        {HEADING_LEVELS.map((level) => (
          <ToolbarButton
            key={level}
            ariaLabel={`Heading ${level}`}
            active={editor.isActive('heading', { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            <span className="text-xs font-semibold">H{level}</span>
          </ToolbarButton>
        ))}
        <ToolbarButton
          ariaLabel="Paragraph"
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <TextH size={18} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          ariaLabel="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <TextB size={18} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          ariaLabel="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <TextItalic size={18} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          ariaLabel="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <TextUnderline size={18} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          ariaLabel="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <TextStrikethrough size={18} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          ariaLabel="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListBullets size={18} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          ariaLabel="Ordered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListNumbers size={18} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          ariaLabel="Blockquote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quotes size={18} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          ariaLabel="Inline code"
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code size={18} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          ariaLabel="Add link"
          active={editor.isActive('link')}
          onClick={setLink}
        >
          <LinkIcon size={18} aria-hidden="true" />
        </ToolbarButton>
      </div>
      <div className="bg-background" style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
