'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { Eye, EyeSlash, ArrowSquareIn, Trash } from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useDict } from '@/contexts/DictContext'
import { getErrorMessage } from '@/lib/clientErrors'
import type { ApiErrorResponse } from '@/lib/errors'
import {
  CATEGORY_LABELS,
  CREDENTIAL_CATEGORIES,
  GROUP_LABELS,
  GROUP_ORDER_BY_CATEGORY,
  type CredentialCategory,
  type CredentialGroup,
} from '@/lib/secrets/credentialKeys'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface CredentialStatus {
  key: string
  label: string
  description: string
  category: string
  group: string
  isSecret: boolean
  docsUrl?: string
  configured: boolean
  updatedAt: string | null
  updatedBy: string | null
}

function secretMaskStyle(hidden: boolean): CSSProperties | undefined {
  return hidden
    ? ({ WebkitTextSecurity: 'disc' } as CSSProperties)
    : undefined
}

export function ApiCredentialsManager() {
  const dict = useDict()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [credentials, setCredentials] = useState<CredentialStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())

  const fetchCredentials = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(dict.errors.AUTH_REQUIRED)

    const res = await fetch('/api/admin/api-credentials', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      const body = (await res.json()) as ApiErrorResponse
      throw new Error(getErrorMessage(body, dict))
    }
    const body = (await res.json()) as { credentials: CredentialStatus[] }
    setCredentials(body.credentials)
  }, [supabase, dict])

  useEffect(() => {
    void fetchCredentials()
      .catch((err) => toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR))
      .finally(() => setLoading(false))
  }, [fetchCredentials, dict])

  const saveCredential = async (key: string) => {
    const value = drafts[key] ?? ''
    setSavingKey(key)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error(dict.errors.AUTH_REQUIRED)

      const res = await fetch('/api/admin/api-credentials', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ key, value }),
      })
      if (!res.ok) {
        const body = (await res.json()) as ApiErrorResponse
        throw new Error(getErrorMessage(body, dict))
      }
      const body = (await res.json()) as { credentials: CredentialStatus[] }
      setCredentials(body.credentials)
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      toast.success('Credential saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    } finally {
      setSavingKey(null)
    }
  }

  const clearCredential = async (key: string) => {
    setSavingKey(key)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error(dict.errors.AUTH_REQUIRED)

      const res = await fetch(`/api/admin/api-credentials/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const body = (await res.json()) as ApiErrorResponse
        throw new Error(getErrorMessage(body, dict))
      }
      await fetchCredentials()
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      toast.success('Credential cleared')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    } finally {
      setSavingKey(null)
    }
  }

  const toggleVisibility = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const grouped = useMemo(() => {
    const map = new Map<CredentialCategory, Map<CredentialGroup, CredentialStatus[]>>()
    for (const cat of CREDENTIAL_CATEGORIES) map.set(cat, new Map())
    for (const cred of credentials) {
      const cat = cred.category as CredentialCategory
      const group = cred.group as CredentialGroup
      const categoryMap = map.get(cat)
      if (!categoryMap) continue
      const items = categoryMap.get(group) ?? []
      items.push(cred)
      categoryMap.set(group, items)
    }
    return map
  }, [credentials])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading API credentials…</p>
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTitle>Encrypted storage</AlertTitle>
        <AlertDescription>
          Values are encrypted with AES-256-GCM before being stored in Supabase. The master key
          lives only in <code>API_CREDENTIALS_ENCRYPTION_KEY</code> (Vercel env). The newsletter
          Edge Function <code>newsletter-confirm</code> still uses separate Supabase Edge Secrets
          for Resend until migrated.
        </AlertDescription>
      </Alert>

      {CREDENTIAL_CATEGORIES.map((category) => {
        const categoryGroups = grouped.get(category)
        if (!categoryGroups || categoryGroups.size === 0) return null

        const orderedGroups = GROUP_ORDER_BY_CATEGORY[category].filter((group) =>
          categoryGroups.has(group),
        )

        return (
          <section key={category} className="space-y-4">
            <h2 className="text-lg font-semibold">{CATEGORY_LABELS[category]}</h2>
            <div className="space-y-4">
              {orderedGroups.map((group) => {
                const items = categoryGroups.get(group) ?? []
                const groupId = `credential-group-${category}-${group}`
                const groupDocsUrl = items.find((item) => item.docsUrl)?.docsUrl

                return (
                  <div
                    key={group}
                    role="group"
                    aria-labelledby={groupId}
                    className="rounded-lg border border-border overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
                      <h3 id={groupId} className="text-sm font-semibold">
                        {GROUP_LABELS[group]}
                      </h3>
                      {groupDocsUrl && (
                        <a
                          href={groupDocsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
                        >
                          Docs
                          <ArrowSquareIn size={14} aria-hidden />
                        </a>
                      )}
                    </div>
                    <div className="divide-y divide-border">
                      {items.map((cred) => {
                        const draft = drafts[cred.key]
                        const hasDraft = draft !== undefined && draft.length > 0
                        const inputId = `credential-${cred.key}`
                        const secretHidden = cred.isSecret && !visibleKeys.has(cred.key)

                        return (
                          <div key={cred.key} className="p-4 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Label htmlFor={inputId} className="font-medium">
                                    {cred.label}
                                  </Label>
                                  <Badge variant={cred.configured ? 'default' : 'secondary'}>
                                    {cred.configured ? 'Configured' : 'Not set'}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{cred.description}</p>
                                <code className="text-xs text-muted-foreground">{cred.key}</code>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                              <div className="relative flex-1">
                                <Input
                                  id={inputId}
                                  type="text"
                                  name={`api-credential-${cred.key}`}
                                  autoComplete="off"
                                  autoCorrect="off"
                                  autoCapitalize="off"
                                  spellCheck={false}
                                  data-1p-ignore="true"
                                  data-lpignore="true"
                                  data-form-type="other"
                                  placeholder={
                                    cred.configured ? 'Enter new value to replace' : 'Not configured'
                                  }
                                  value={draft ?? ''}
                                  style={secretMaskStyle(secretHidden)}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({ ...prev, [cred.key]: e.target.value }))
                                  }
                                  disabled={savingKey === cred.key}
                                  aria-describedby={`${inputId}-hint`}
                                />
                                {cred.isSecret && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                    onClick={() => toggleVisibility(cred.key)}
                                    aria-label={visibleKeys.has(cred.key) ? 'Hide value' : 'Show value'}
                                  >
                                    {visibleKeys.has(cred.key) ? (
                                      <EyeSlash size={16} aria-hidden />
                                    ) : (
                                      <Eye size={16} aria-hidden />
                                    )}
                                  </Button>
                                )}
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  type="button"
                                  onClick={() => void saveCredential(cred.key)}
                                  disabled={savingKey === cred.key || !hasDraft}
                                >
                                  {savingKey === cred.key ? 'Saving…' : 'Save'}
                                </Button>
                                {cred.configured && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => void clearCredential(cred.key)}
                                    disabled={savingKey === cred.key}
                                    aria-label={`Clear ${cred.label}`}
                                  >
                                    <Trash size={16} aria-hidden />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
                              {cred.configured && cred.updatedAt
                                ? `Last updated ${new Date(cred.updatedAt).toLocaleString()}`
                                : 'Leave blank and save to clear an existing value'}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}