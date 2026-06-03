'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Files, X } from '@phosphor-icons/react'
import type { MessageTemplate } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RichTextEditor } from './RichTextEditor'

interface MessageComposerProps {
  artists: Array<{ id: string; name: string }>
  onSend: (artistIds: string[], subject: string, html: string, text: string) => Promise<void>
  isSending?: boolean
  templates?: MessageTemplate[]
}

interface DraftState {
  selectedArtistIds: string[]
  subject: string
  bodyHtml: string
  bodyText: string
}

const ALL_ARTISTS_ID = '__all__'
const DRAFT_STORAGE_KEY = 'msg-draft'

function htmlToText(html: string): string {
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const container = document.createElement('div')
  container.innerHTML = html
  return container.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

export function MessageComposer({ artists, onSend, isSending = false, templates = [] }: MessageComposerProps) {
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!stored) {
      setHasHydratedDraft(true)
      return
    }
    try {
      const draft = JSON.parse(stored) as DraftState
      setSelectedArtistIds(draft.selectedArtistIds ?? [])
      setSubject(draft.subject ?? '')
      setBodyHtml(draft.bodyHtml ?? '')
      setBodyText(draft.bodyText ?? '')
    } catch {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    } finally {
      setHasHydratedDraft(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !hasHydratedDraft) return
    const draft: DraftState = { selectedArtistIds, subject, bodyHtml, bodyText }
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }, [bodyHtml, bodyText, hasHydratedDraft, selectedArtistIds, subject])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const targetArtistIds = useMemo(
    () => (selectedArtistIds.includes(ALL_ARTISTS_ID) ? artists.map((artist) => artist.id) : selectedArtistIds),
    [artists, selectedArtistIds],
  )

  const selectedLabels = useMemo(
    () =>
      selectedArtistIds.includes(ALL_ARTISTS_ID)
        ? [{ id: ALL_ARTISTS_ID, name: 'All Artists' }]
        : artists.filter((artist) => selectedArtistIds.includes(artist.id)),
    [artists, selectedArtistIds],
  )

  const toggleArtist = (id: string) => {
    if (id === ALL_ARTISTS_ID) {
      setSelectedArtistIds((current) =>
        current.includes(ALL_ARTISTS_ID) ? [] : [ALL_ARTISTS_ID, ...artists.map((artist) => artist.id)],
      )
      return
    }

    setSelectedArtistIds((current) => {
      const next = current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current.filter((value) => value !== ALL_ARTISTS_ID), id]
      return next.length === artists.length ? [ALL_ARTISTS_ID, ...artists.map((artist) => artist.id)] : next
    })
  }

  const removeArtist = (id: string) => {
    setSelectedArtistIds((current) => current.filter((value) => value !== id && value !== ALL_ARTISTS_ID))
  }

  const applyTemplate = (template: MessageTemplate) => {
    setSubject(template.subject)
    setBodyHtml(template.bodyHtml)
    setBodyText(htmlToText(template.bodyHtml))
  }

  const handleSubmit = async () => {
    if (targetArtistIds.length === 0 || !subject.trim() || !bodyText.trim()) return
    await onSend(targetArtistIds, subject.trim(), bodyHtml, bodyText.trim())
    setSelectedArtistIds([])
    setSubject('')
    setBodyHtml('')
    setBodyText('')
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    }
  }

  return (
    <div
      className="space-y-4 rounded-lg border border-border p-4"
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault()
          void handleSubmit()
        }
      }}
    >
      <div className="space-y-2">
        <Label>Artist(s)</Label>
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            aria-expanded={dropdownOpen}
            aria-label="Select artists"
            className="flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-left text-sm hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setDropdownOpen((current) => !current)}
          >
            {selectedLabels.length === 0 ? (
              <span className="text-muted-foreground">Select artist(s)…</span>
            ) : (
              selectedLabels.map((artist) => (
                <Badge key={artist.id} variant="secondary" className="flex items-center gap-1 pr-1">
                  {artist.name}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${artist.name}`}
                    className="rounded-full p-1 hover:bg-destructive/20"
                    onMouseDown={(event) => {
                      event.stopPropagation()
                      removeArtist(artist.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        removeArtist(artist.id)
                      }
                    }}
                  >
                    <X size={12} aria-hidden="true" />
                  </span>
                </Badge>
              ))
            )}
          </button>
          {dropdownOpen && (
            <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center gap-2 border-b border-border px-3 py-2 text-sm font-semibold hover:bg-accent hover:text-accent-foreground"
                onClick={() => toggleArtist(ALL_ARTISTS_ID)}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded border border-primary">
                  {selectedArtistIds.includes(ALL_ARTISTS_ID) && <Check size={10} weight="bold" aria-hidden="true" />}
                </span>
                All Artists
              </button>
              {artists.map((artist) => (
                <button
                  key={artist.id}
                  type="button"
                  className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => toggleArtist(artist.id)}
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded border border-primary">
                    {selectedArtistIds.includes(artist.id) && <Check size={10} weight="bold" aria-hidden="true" />}
                  </span>
                  {artist.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="message-subject">Subject</Label>
          <Input id="message-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
        </div>
        {templates.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="min-h-[44px] gap-2">
                <Files size={18} aria-hidden="true" />
                Templates
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-2">
              <div className="space-y-1">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="flex min-h-[44px] w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-accent"
                    onClick={() => applyTemplate(template)}
                  >
                    <span className="font-medium">{template.name}</span>
                    <span className="text-sm text-muted-foreground">{template.subject || 'Untitled template'}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="space-y-2">
        <Label>Body</Label>
        <RichTextEditor
          value={bodyHtml}
          placeholder="Write your message…"
          onChange={(html, text) => {
            setBodyHtml(html)
            setBodyText(text)
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Press Ctrl+Enter to send.</p>
        <Button
          type="button"
          className="min-h-[44px]"
          disabled={isSending || targetArtistIds.length === 0 || !subject.trim() || !bodyText.trim()}
          onClick={() => void handleSubmit()}
        >
          {isSending ? 'Sending…' : `Send Message${targetArtistIds.length > 1 ? ` to ${targetArtistIds.length} Artists` : ''}`}
        </Button>
      </div>
    </div>
  )
}
