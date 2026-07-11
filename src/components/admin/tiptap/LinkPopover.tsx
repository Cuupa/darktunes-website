'use client'

/**
 * LinkPopover — dialog for inserting/editing links in the TipTap editor.
 * Toolbar button opens a modal with URL, display text, and new-tab options.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { getMarkRange, type Editor } from '@tiptap/core'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Link as LinkIcon } from '@phosphor-icons/react'

interface Props {
  editor: Editor
  disabled?: boolean
}

function getSelectedText(editor: Editor): string {
  const { from, to, empty } = editor.state.selection
  if (empty) return ''
  return editor.state.doc.textBetween(from, to, ' ')
}

function getActiveLinkText(editor: Editor): string {
  if (!editor.isActive('link')) return ''
  const linkType = editor.schema.marks.link
  if (!linkType) return ''
  const $pos = editor.state.doc.resolve(editor.state.selection.from)
  const range = getMarkRange($pos, linkType)
  if (!range) return ''
  return editor.state.doc.textBetween(range.from, range.to, ' ')
}

export function applyLinkPopover({
  editor,
  url,
  linkText,
  newTab,
  linkColor,
}: {
  editor: Editor
  url: string
  linkText: string
  newTab: boolean
  linkColor: string
}): void {
  const href = url.trim()
  if (!href) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  const displayText = linkText.trim() || href
  const target = newTab ? '_blank' : '_self'
  const linkAttrs = { href, target, rel: 'noopener noreferrer' }

  if (editor.isActive('link')) {
    const chain = editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .deleteSelection()
      .insertContent({
        type: 'text',
        text: displayText,
        marks: [{ type: 'link', attrs: linkAttrs }],
      })

    if (linkColor) {
      chain.setColor(linkColor).run()
    } else {
      chain.run()
    }
    return
  }

  const { empty } = editor.state.selection
  if (!empty) {
    const chain = editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent({
        type: 'text',
        text: displayText,
        marks: [{ type: 'link', attrs: linkAttrs }],
      })

    if (linkColor) {
      chain.setColor(linkColor).run()
    } else {
      chain.run()
    }
    return
  }

  const chain = editor.chain().focus().insertContent({
    type: 'text',
    text: displayText,
    marks: [{ type: 'link', attrs: linkAttrs }],
  })

  if (linkColor) {
    chain.setColor(linkColor).run()
  } else {
    chain.run()
  }
}

export function LinkPopover({ editor, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [newTab, setNewTab] = useState(true)
  const [linkColor, setLinkColor] = useState('')

  // Prefill with current link attrs when opening
  useEffect(() => {
    if (!open) return
    const attrs = editor.getAttributes('link')
    setUrl((attrs.href as string | undefined) ?? '')
    setNewTab((attrs.target as string | undefined) !== '_self')
    setLinkColor((editor.getAttributes('textStyle').color as string | undefined) ?? '')

    if (editor.isActive('link')) {
      setLinkText(getActiveLinkText(editor))
    } else {
      setLinkText(getSelectedText(editor))
    }
  }, [open, editor])

  const handleApply = useCallback(() => {
    applyLinkPopover({ editor, url, linkText, newTab, linkColor })
    setOpen(false)
  }, [editor, url, linkText, newTab, linkColor])

  const handleRemove = useCallback(() => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setOpen(false)
  }, [editor])

  const handleOpen = useCallback(() => {
    if (disabled) return
    setOpen(true)
  }, [disabled])

  const isActive = editor.isActive('link')

  return (
    <>
      <Button
        type="button"
        variant={isActive ? 'default' : 'ghost'}
        size="icon"
        className={`h-7 w-7 ${isActive ? 'bg-accent text-accent-foreground' : ''}`}
        title="Insert / Edit Link"
        aria-label="Insert / Edit Link"
        aria-pressed={isActive}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleOpen}
      >
        <span aria-hidden="true"><LinkIcon className="w-3.5 h-3.5" /></span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" aria-labelledby="link-dialog-title">
          <DialogHeader>
            <DialogTitle id="link-dialog-title">Insert / Edit Link</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="link-popover-text">Link text</Label>
              <Input
                id="link-popover-text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Display text"
                onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-popover-url">URL</Label>
              <Input
                id="link-popover-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="link-popover-newtab" checked={newTab} onCheckedChange={setNewTab} />
              <Label htmlFor="link-popover-newtab">Open in new tab</Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-popover-color">Link text color (optional)</Label>
              <div className="flex items-center gap-2">
                <input
                  id="link-popover-color"
                  type="color"
                  value={linkColor || '#ffffff'}
                  onChange={(e) => setLinkColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
                {linkColor && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setLinkColor('')} className="h-7 px-2 text-xs">
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {isActive && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive sm:mr-auto"
                onClick={handleRemove}
              >
                Remove link
              </Button>
            )}
            <Button type="button" size="sm" onClick={handleApply}>
              {url.trim() ? 'Apply' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}