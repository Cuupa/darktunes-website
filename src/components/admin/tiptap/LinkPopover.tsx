'use client'

/**
 * LinkPopover — replaces window.prompt() for inserting/editing links in the editor.
 * Renders as a toolbar button that opens a Popover with URL input.
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Link as LinkIcon } from '@phosphor-icons/react'

interface Props {
  editor: Editor
  disabled?: boolean
}

export function LinkPopover({ editor, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [newTab, setNewTab] = useState(true)

  // Prefill with current link attrs when opening
  useEffect(() => {
    if (!open) return
    const attrs = editor.getAttributes('link')
    setUrl((attrs.href as string | undefined) ?? '')
    setNewTab((attrs.target as string | undefined) !== '_self')
  }, [open, editor])

  const handleApply = useCallback(() => {
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({
        href: url.trim(),
        target: newTab ? '_blank' : '_self',
      }).run()
    }
    setOpen(false)
  }, [editor, url, newTab])

  const handleRemove = useCallback(() => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setOpen(false)
  }, [editor])

  const isActive = editor.isActive('link')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={isActive ? 'default' : 'ghost'}
          size="icon"
          className={`h-7 w-7 ${isActive ? 'bg-accent text-accent-foreground' : ''}`}
          title="Insert / Edit Link"
          aria-label="Insert / Edit Link"
          aria-pressed={isActive}
          disabled={disabled}
        >
          <span aria-hidden="true"><LinkIcon className="w-3.5 h-3.5" /></span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 space-y-3" align="start">
        <div className="space-y-1.5">
          <Label htmlFor="link-popover-url">URL</Label>
          <Input
            id="link-popover-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
            autoFocus
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="link-popover-newtab" checked={newTab} onCheckedChange={setNewTab} />
          <Label htmlFor="link-popover-newtab">Open in new tab</Label>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" className="flex-1" onClick={handleApply}>
            {url.trim() ? 'Apply' : 'Remove'}
          </Button>
          {isActive && (
            <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleRemove}>
              Remove link
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
