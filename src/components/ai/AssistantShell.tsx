'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { PaperPlaneTilt, Sparkle, Square, Trash, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollPanel } from '@/components/ui/scroll-panel'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { getErrorMessage } from '@/lib/clientErrors'
import type { ApiErrorResponse } from '@/lib/errors'

type ChatState = 'idle' | 'connecting' | 'streaming' | 'tool_running' | 'awaiting_confirmation' | 'failed'
type PendingConfirmation = { action: string; confirmation_token: string; summary: string }
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string }

interface AssistantShellProps {
  dashboard: 'portal' | 'admin' | 'editor'
}

async function accessToken(): Promise<string | null> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export function AssistantShell({ dashboard }: AssistantShellProps) {
  const t = useTranslations('ai')
  const tErrors = useTranslations('errors')
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const artistId = searchParams.get('artistId')
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<ChatState>('idle')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingConfirmation | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const sendingRef = useRef(false)
  const errorRef = searchParams.get('error_ref') ?? searchParams.get('ai_error')

  useEffect(() => {
    if (!errorRef) return
    setOpen(true)
    setInput((current) => current || `Please explain error ${errorRef}`)
  }, [errorRef])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const headers = useCallback(async () => {
    const token = await accessToken()
    const next = new Headers({ 'Content-Type': 'application/json' })
    if (token) next.set('Authorization', `Bearer ${token}`)
    return next
  }, [])

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationId) return conversationId
    const res = await fetch('/api/ai/conversations', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({ artist_id: artistId }),
    })
    if (!res.ok) {
      const body = (await res.json()) as ApiErrorResponse
      throw new Error(getErrorMessage(body, tErrors))
    }
    const body = (await res.json()) as { id: string }
    setConversationId(body.id)
    return body.id
  }, [artistId, conversationId, headers, tErrors])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sendingRef.current) return
    sendingRef.current = true
    setInput('')
    setError(null)
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: text }])
    const assistantId = crypto.randomUUID()
    setMessages((current) => [...current, { id: assistantId, role: 'assistant', content: '' }])
    setState('connecting')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const id = await ensureConversation()
      const res = await fetch(`/api/ai/conversations/${id}/messages`, {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({
          content: text,
          artist_id: artistId,
          locale,
          page: { dashboard, path: pathname, locale },
        }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as ApiErrorResponse | null
        throw new Error(body ? getErrorMessage(body, tErrors) : t('statusFailed'))
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let awaitingConfirmation = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split(/\r?\n\r?\n/)
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          const dataLine = frame.split(/\r?\n/).find((line) => line.startsWith('data:'))
          if (!dataLine) continue
          let payload: {
            type: string
            text?: string
            state?: string
            code?: string
            detail?: string
            model?: string
            action?: string
            confirmation_token?: string
            summary?: string
          }
          try {
            payload = JSON.parse(dataLine.slice(5).trim()) as typeof payload
          } catch {
            continue
          }
          if (payload.type === 'status' && payload.state === 'tool_running') setState('tool_running')
          if (payload.type === 'status' && payload.state === 'streaming') setState('streaming')
          if (payload.type === 'delta' && payload.text) {
            setState('streaming')
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, content: message.content + payload.text } : message,
              ),
            )
          }
          if (payload.type === 'error') {
            setError(payload.detail ?? t('statusFailed'))
            setState('failed')
          }
          if (payload.type === 'confirmation_required' && payload.action && payload.confirmation_token && payload.summary) {
            awaitingConfirmation = true
            setPending({
              action: payload.action,
              confirmation_token: payload.confirmation_token,
              summary: payload.summary,
            })
            setState('awaiting_confirmation')
          }
          if (payload.type === 'done') {
            setModel(payload.model ?? null)
            if (!awaitingConfirmation) setState('idle')
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setState('idle')
      } else {
        setError(err instanceof Error ? err.message : t('statusFailed'))
        setState('failed')
      }
    } finally {
      sendingRef.current = false
      abortRef.current = null
    }
  }, [artistId, dashboard, ensureConversation, headers, input, locale, pathname, t, tErrors])

  const stop = useCallback(async () => {
    abortRef.current?.abort()
    if (conversationId) {
      await fetch(`/api/ai/conversations/${conversationId}/cancellations`, {
        method: 'POST',
        headers: await headers(),
      }).catch(() => undefined)
    }
    setState('idle')
  }, [conversationId, headers])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setConversationId(null)
    setMessages([])
    setError(null)
    setModel(null)
    setPending(null)
    setState('idle')
  }, [])

  const confirmPending = useCallback(async () => {
    if (!pending) return
    const res = await fetch('/api/ai/action-confirmations', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({
        confirmation_token: pending.confirmation_token,
        action: pending.action,
        artist_id: artistId,
      }),
    })
    if (!res.ok) {
      const body = (await res.json()) as ApiErrorResponse
      setError(getErrorMessage(body, tErrors))
      setState('failed')
      return
    }
    const body = (await res.json()) as { detail: string }
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: body.detail }])
    setPending(null)
    setState('idle')
  }, [artistId, headers, pending, tErrors])

  const busy = state === 'connecting' || state === 'streaming' || state === 'tool_running'

  const statusLabel = useMemo(() => {
    if (state === 'connecting') return t('statusConnecting')
    if (state === 'streaming') return t('statusStreaming')
    if (state === 'tool_running') return t('statusTool')
    if (state === 'failed') return error ?? t('statusFailed')
    return null
  }, [error, state, t])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4 z-[40] h-11 w-11 rounded-full shadow-lg md:bottom-6 md:right-6"
        onClick={() => setOpen(true)}
        aria-label={t('open')}
      >
        <Sparkle className="h-5 w-5" aria-hidden />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle>{t('title')}</SheetTitle>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={reset} aria-label={t('newConversation')}>
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (conversationId) {
                      void (async () => {
                        try {
                          const auth = await headers()
                          await fetch(`/api/ai/conversations/${conversationId}`, {
                            method: 'DELETE',
                            headers: auth,
                          })
                        } catch {
                          // fire-and-forget; local state already reset
                        }
                      })()
                    }
                    reset()
                  }}
                  aria-label={t('deleteConversation')}
                >
                  <Trash className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('shortcutHint')}</p>
          </SheetHeader>
          <ScrollPanel className="flex-1 space-y-3 px-4 py-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                    message.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {message.content}
                </div>
              ))
            )}
            {statusLabel ? (
              <p className="text-xs text-muted-foreground" role="status">
                {statusLabel}
              </p>
            ) : null}
            {model ? <p className="text-xs text-muted-foreground">{t('model', { model })}</p> : null}
            {pending ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm">{pending.summary}</p>
                <Button type="button" onClick={() => void confirmPending()}>
                  {t('confirmAction')}
                </Button>
              </div>
            ) : null}
          </ScrollPanel>
          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t('placeholder')}
              rows={2}
              className="min-h-[44px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
            />
            {busy ? (
              <Button type="button" size="icon" variant="secondary" onClick={() => void stop()} aria-label={t('stop')}>
                <Square className="h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!input.trim()} aria-label={t('send')}>
                <PaperPlaneTilt className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
