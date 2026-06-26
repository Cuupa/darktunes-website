'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  Code,
  Image as ImageIcon,
  YoutubeLogo,
  ListBullets,
  ListNumbers,
  Quotes,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  TextAlignJustify,
  TextH,
  ArrowCounterClockwise,
  ArrowClockwise,
  Minus,
} from '@phosphor-icons/react'
import { ResizableImageExtension } from '@/components/admin/tiptap/ResizableImageExtension'
import { ImageInsertDialog } from '@/components/admin/tiptap/ImageInsertDialog'
import { ImageBubbleMenu } from '@/components/admin/tiptap/ImageBubbleMenu'
import { LinkPopover } from '@/components/admin/tiptap/LinkPopover'
import { YouTubeEmbedExtension } from '@/components/admin/tiptap/YouTubeEmbedExtension'
import { VideoInsertDialog } from '@/components/admin/tiptap/VideoInsertDialog'
import { containsEmojis, stripEmojis, stripEmojisFromHtml } from '@/lib/stripEmojis'

interface TiptapEditorProps {
  value: string
  onChange: (html: string) => void
  /** Also receive the plain-text content (used by compact / messaging mode) */
  onChangeWithText?: (html: string, text: string) => void
  disabled?: boolean
  placeholder?: string
  /** Compact mode hides alignment, image, and color controls */
  compact?: boolean
}

const HEADING_LEVELS = [1, 2, 3] as const

export function TiptapEditor({ value, onChange, onChangeWithText, disabled, placeholder, compact }: TiptapEditorProps) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [videoDialogOpen, setVideoDialogOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        // StarterKit v3 bundles Link and Underline; disable them here so the
        // explicitly configured extensions below do not create duplicates.
        link: false,
        underline: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      ResizableImageExtension,
      YouTubeEmbedExtension,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Color,
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none min-h-[300px] max-h-[500px] overflow-y-auto p-4 focus:outline-none',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
      handlePaste: (_view, event) => {
        const pastedText = event.clipboardData?.getData('text/plain') ?? ''
        const pastedHtml = event.clipboardData?.getData('text/html') ?? ''
        if (!containsEmojis(pastedText) && !containsEmojis(pastedHtml)) {
          return false
        }

        event.preventDefault()
        const cleaned = pastedHtml
          ? stripEmojisFromHtml(pastedHtml)
          : stripEmojis(pastedText)
        _view.dispatch(_view.state.tr.insertText(cleaned))
        return true
      },
    },
    onUpdate: ({ editor }) => {
      let html = editor.getHTML()
      if (containsEmojis(html)) {
        html = stripEmojisFromHtml(html)
        editor.commands.setContent(html, { emitUpdate: false })
      }
      onChange(html)
      onChangeWithText?.(html, editor.getText())
    },
  })

  // Sync external value changes (e.g., when loading a post for editing)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value ?? '', { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Sync disabled state
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  if (!editor) return null

  const ToolbarButton = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void
    active?: boolean
    title: string
    children: React.ReactNode
  }) => (
    <Button
      type="button"
      variant={active ? 'default' : 'ghost'}
      size="icon"
      className={`h-7 w-7 ${active ? 'bg-accent text-accent-foreground' : ''}`}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
    >
      <span aria-hidden="true">{children}</span>
    </Button>
  )

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-muted/50">
        {/* Undo / Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <ArrowCounterClockwise className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <ArrowClockwise className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

        {/* Headings */}
        {HEADING_LEVELS.map((level) => (
          <ToolbarButton
            key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            active={editor.isActive('heading', { level })}
            title={`Heading ${level}`}
          >
            <span className="text-[10px] font-bold">H{level}</span>
          </ToolbarButton>
        ))}
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive('paragraph')}
          title="Paragraph"
        >
          <TextH className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

        {/* Inline formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <TextB className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <TextItalic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline"
        >
          <TextUnderline className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <TextStrikethrough className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Inline Code"
        >
          <Code className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <ListBullets className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Ordered List"
        >
          <ListNumbers className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Blockquote"
        >
          <Quotes className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

        {/* Alignment — hidden in compact mode */}
        {!compact && (
          <>
            <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              active={editor.isActive({ textAlign: 'left' })}
              title="Align Left"
            >
              <TextAlignLeft className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              active={editor.isActive({ textAlign: 'center' })}
              title="Align Center"
            >
              <TextAlignCenter className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              active={editor.isActive({ textAlign: 'right' })}
              title="Align Right"
            >
              <TextAlignRight className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              active={editor.isActive({ textAlign: 'justify' })}
              title="Justify"
            >
              <TextAlignJustify className="w-3.5 h-3.5" />
            </ToolbarButton>
          </>
        )}

        <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

        {/* Text color — hidden in compact mode */}
        {!compact && (
          <>
            <label
              className="relative h-7 w-7 flex items-center justify-center rounded hover:bg-accent/20 cursor-pointer"
              title="Text Color"
              aria-label="Text Color"
            >
              <span aria-hidden="true" className="text-xs font-bold" style={{ textDecoration: 'underline', textDecorationColor: editor.getAttributes('textStyle').color ?? '#ffffff' }}>A</span>
              <input
                type="color"
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                defaultValue={editor.getAttributes('textStyle').color ?? '#ffffff'}
                onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                disabled={disabled}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-xs"
              onClick={() => editor.chain().focus().unsetColor().run()}
              title="Remove Text Color"
              aria-label="Remove Text Color"
              disabled={disabled}
            >
              <span aria-hidden="true">✕</span>
            </Button>
          </>
        )}

        <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

        {/* Link & Image */}
        <LinkPopover editor={editor} disabled={disabled} />
        {/* Image insert — hidden in compact mode */}
        {!compact && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setImageDialogOpen(true)}
            title="Insert Image"
            aria-label="Insert Image"
            disabled={disabled}
          >
            <span aria-hidden="true"><ImageIcon className="w-3.5 h-3.5" /></span>
          </Button>
        )}
        {/* Video insert — hidden in compact mode */}
        {!compact && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setVideoDialogOpen(true)}
            title="Insert Video"
            aria-label="Insert Video"
            disabled={disabled}
          >
            <span aria-hidden="true"><YoutubeLogo className="w-3.5 h-3.5" /></span>
          </Button>
        )}
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />

      {/* Bubble menu for selected images */}
      {!compact && <ImageBubbleMenu editor={editor} />}

      {/* Image insert dialog */}
      {!compact && (
        <ImageInsertDialog
          editor={editor}
          open={imageDialogOpen}
          onClose={() => setImageDialogOpen(false)}
        />
      )}

      {/* Video insert dialog */}
      {!compact && (
        <VideoInsertDialog
          editor={editor}
          open={videoDialogOpen}
          onClose={() => setVideoDialogOpen(false)}
        />
      )}
    </div>
  )
}
