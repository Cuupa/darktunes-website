'use client'

import { TiptapEditor } from '@/components/admin/TiptapEditor'

interface RichTextEditorProps {
  value: string
  onChange: (html: string, text: string) => void
  disabled?: boolean
  placeholder?: string
  minHeight?: number
}

/**
 * Compact rich-text editor used throughout the messaging system.
 * Delegates to the canonical TiptapEditor (compact mode) so that there is a
 * single implementation for all rich-text editing in the application.
 */
export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder,
  minHeight,
}: RichTextEditorProps) {
  return (
    <TiptapEditor
      value={value}
      onChange={() => {
        // Data flows through onChangeWithText which provides both html and text
      }}
      onChangeWithText={onChange}
      disabled={disabled}
      placeholder={placeholder}
      compact
      minHeight={minHeight}
    />
  )
}
