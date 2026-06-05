'use client'

/**
 * ImageBubbleMenu — floating toolbar shown when a resizableImage node is selected.
 *
 * Uses BubbleMenu from @tiptap/react/menus (floating-ui based, Tiptap v3).
 */

import React, { useState } from 'react'
import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  AlignCenterVerticalSimple,
  Link as LinkIcon,
  Trash,
  TextT,
} from '@phosphor-icons/react'
import type { ImageFloat } from './ResizableImageExtension'

interface Props {
  editor: Editor
}

const FLOAT_BUTTONS: { value: ImageFloat; label: string; icon: React.ReactNode }[] = [
  { value: 'left', label: 'Float left', icon: <TextAlignLeft className="w-3.5 h-3.5" /> },
  { value: 'center', label: 'Center', icon: <TextAlignCenter className="w-3.5 h-3.5" /> },
  { value: 'right', label: 'Float right', icon: <TextAlignRight className="w-3.5 h-3.5" /> },
  { value: 'none', label: 'Full width', icon: <AlignCenterVerticalSimple className="w-3.5 h-3.5" /> },
]

const WIDTH_PRESETS = ['25%', '50%', '75%', '100%']

export function ImageBubbleMenu({ editor }: Props) {
  const [linkInput, setLinkInput] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)

  const attrs = editor.isActive('resizableImage')
    ? (editor.getAttributes('resizableImage') as Record<string, string | null>)
    : null

  const currentFloat = (attrs?.['data-float'] as ImageFloat | undefined) ?? 'none'
  const currentCaption = attrs?.['data-caption'] ?? null

  const setFloat = (value: ImageFloat) => {
    editor.chain().focus().updateAttributes('resizableImage', { 'data-float': value }).run()
  }

  const setWidth = (width: string) => {
    editor.chain().focus().updateAttributes('resizableImage', { 'data-width': width }).run()
  }

  const toggleCaption = () => {
    editor.chain().focus().updateAttributes('resizableImage', {
      'data-caption': currentCaption ? null : ' ',
    }).run()
  }

  const applyLink = () => {
    editor.chain().focus().updateAttributes('resizableImage', {
      'data-link-href': linkInput.trim() || null,
    }).run()
    setLinkOpen(false)
  }

  const removeLink = () => {
    editor.chain().focus().updateAttributes('resizableImage', { 'data-link-href': null }).run()
    setLinkInput('')
    setLinkOpen(false)
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e }) => e.isActive('resizableImage')}
      options={{ placement: 'top' }}
    >
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-md">
        {/* Float buttons */}
        {FLOAT_BUTTONS.map(({ value, label, icon }) => (
          <Button
            key={value}
            type="button"
            variant={currentFloat === value ? 'default' : 'ghost'}
            size="icon"
            className={`h-7 w-7 ${currentFloat === value ? 'bg-accent text-accent-foreground' : ''}`}
            title={label}
            aria-label={label}
            aria-pressed={currentFloat === value}
            onClick={() => setFloat(value)}
          >
            <span aria-hidden="true">{icon}</span>
          </Button>
        ))}

        <div className="w-px h-5 bg-border mx-0.5" aria-hidden="true" />

        {/* Width presets */}
        {WIDTH_PRESETS.map((w) => (
          <Button
            key={w}
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-xs"
            title={`Set width to ${w}`}
            onClick={() => setWidth(w)}
          >
            {w}
          </Button>
        ))}

        <div className="w-px h-5 bg-border mx-0.5" aria-hidden="true" />

        {/* Caption toggle */}
        <Button
          type="button"
          variant={currentCaption ? 'default' : 'ghost'}
          size="icon"
          className={`h-7 w-7 ${currentCaption ? 'bg-accent text-accent-foreground' : ''}`}
          title="Toggle caption"
          aria-label="Toggle caption"
          aria-pressed={!!currentCaption}
          onClick={toggleCaption}
        >
          <span aria-hidden="true"><TextT className="w-3.5 h-3.5" /></span>
        </Button>

        {/* Link popover */}
        <Popover open={linkOpen} onOpenChange={(o) => {
          setLinkOpen(o)
          if (o) setLinkInput(attrs?.['data-link-href'] ?? '')
        }}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={attrs?.['data-link-href'] ? 'default' : 'ghost'}
              size="icon"
              className={`h-7 w-7 ${attrs?.['data-link-href'] ? 'bg-accent text-accent-foreground' : ''}`}
              title="Image link"
              aria-label="Image link"
              aria-pressed={!!attrs?.['data-link-href']}
            >
              <span aria-hidden="true"><LinkIcon className="w-3.5 h-3.5" /></span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-2" align="start">
            <Input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://…"
              onKeyDown={(e) => { if (e.key === 'Enter') applyLink() }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" className="flex-1" onClick={applyLink}>
                Apply
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={removeLink} className="text-destructive hover:text-destructive">
                Remove
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-border mx-0.5" aria-hidden="true" />

        {/* Delete */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          title="Delete image"
          aria-label="Delete image"
          onClick={() => editor.chain().focus().deleteSelection().run()}
        >
          <span aria-hidden="true"><Trash className="w-3.5 h-3.5" /></span>
        </Button>
      </div>
    </BubbleMenu>
  )
}
