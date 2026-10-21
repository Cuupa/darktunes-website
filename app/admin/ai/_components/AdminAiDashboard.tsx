'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/clientErrors'
import type { ApiErrorResponse } from '@/lib/errors'

interface SettingsPayload {
  enabled: boolean
  test_mode: boolean
  default_streaming: boolean
  model_fast: string
  model_reasoning: string
  last_connection_test: Record<string, unknown> | null
}

interface AvailableModel {
  id: string
  name: string
}

async function authHeaders(): Promise<Headers> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase.auth.getSession()
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`)
  return headers
}

export function AdminAiDashboard() {
  const t = useTranslations('ai')
  const tErrors = useTranslations('errors')
  const [settings, setSettings] = useState<SettingsPayload | null>(null)
  const [today, setToday] = useState(0)
  const [month, setMonth] = useState(0)
  const [diagnostics, setDiagnostics] = useState<Array<{ id: string; error_reference: string; classification: string | null }>>([])
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  const load = useCallback(async () => {
    const headers = await authHeaders()
    const [settingsRes, usageRes, diagRes, modelsRes] = await Promise.all([
      fetch('/api/admin/ai/settings', { headers }),
      fetch('/api/admin/ai/usage', { headers }),
      fetch('/api/admin/ai/diagnostics', { headers }),
      fetch('/api/admin/ai/models', { headers }),
    ])
    if (settingsRes.ok) setSettings((await settingsRes.json()) as SettingsPayload)
    if (usageRes.ok) {
      const body = (await usageRes.json()) as { today_tokens: number; month_tokens: number }
      setToday(body.today_tokens)
      setMonth(body.month_tokens)
    }
    if (diagRes.ok) {
      const body = (await diagRes.json()) as { items: Array<{ id: string; error_reference: string; classification: string | null }> }
      setDiagnostics(body.items)
    }
    if (modelsRes.ok) {
      const body = (await modelsRes.json()) as { models: AvailableModel[] }
      setAvailableModels(body.models ?? [])
    } else {
      setAvailableModels([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const lastTestOk = useMemo(() => {
    const last = settings?.last_connection_test
    return last && last.ok === true
  }, [settings])

  const lastTestSteps = useMemo(() => {
    const value = settings?.last_connection_test?.steps
    if (!Array.isArray(value)) return []
    return value.filter((step): step is {
      step: string
      ok: boolean
      latency_ms: number
      error_code: string | null
      detail: string | null
    } => Boolean(step) && typeof step === 'object' && typeof step.step === 'string' && typeof step.ok === 'boolean')
  }, [settings])

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/ai/settings', {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({
          enabled: settings.enabled,
          test_mode: settings.test_mode,
          default_streaming: settings.default_streaming,
          model_fast: settings.model_fast,
          model_reasoning: settings.model_reasoning,
        }),
      })
      if (!res.ok) {
        const body = (await res.json()) as ApiErrorResponse
        throw new Error(getErrorMessage(body, tErrors))
      }
      toast.success(t('settingsSaved'))
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/admin/ai/connection-tests', {
        method: 'POST',
        headers: await authHeaders(),
        body: '{}',
      })
      const body = (await res.json()) as ApiErrorResponse & { ok?: boolean }
      if (!res.ok) throw new Error(getErrorMessage(body, tErrors))
      toast.success(body.ok ? t('testConnection') : t('statusFailed'))
      await load()
    } catch (err) {
      // Failed probes are persisted by the API. Reload them instead of only showing a generic toast.
      await load().catch(() => undefined)
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setTesting(false)
    }
  }

  const fetchModels = async () => {
    setLoadingModels(true)
    try {
      const res = await fetch('/api/admin/ai/models', { headers: await authHeaders() })
      if (!res.ok) throw new Error(t('modelsLoadFailed'))
      const body = (await res.json()) as { models: AvailableModel[] }
      setAvailableModels(body.models ?? [])
    } catch {
      toast.error(t('modelsLoadFailed'))
    } finally {
      setLoadingModels(false)
    }
  }

  const modelOptions = useMemo(() => {
    if (!settings) return []
    const extraIds = new Set<string>([settings.model_fast, settings.model_reasoning])
    const knownIds = new Set(availableModels.map((m) => m.id))
    const all: Array<{ value: string; label: string }> = availableModels.map((m) => ({
      value: m.id,
      label: m.name || m.id,
    }))
    for (const id of extraIds) {
      if (id && !knownIds.has(id)) {
        all.push({ value: id, label: id })
      }
    }
    return all
  }, [availableModels, settings])

  if (!settings) return <p className="text-sm text-muted-foreground">{t('statusConnecting')}</p>

  return (
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">{t('tabGeneral')}</TabsTrigger>
        <TabsTrigger value="models">{t('tabModels')}</TabsTrigger>
        <TabsTrigger value="tokens">{t('tabTokens')}</TabsTrigger>
        <TabsTrigger value="diagnostics">{t('tabDiagnostics')}</TabsTrigger>
        <TabsTrigger value="health">{t('tabHealth')}</TabsTrigger>
      </TabsList>
      <TabsContent value="general" className="space-y-4 pt-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="ai-enabled">{t('enableLabel')}</Label>
          <Switch
            id="ai-enabled"
            checked={settings.enabled}
            onCheckedChange={(enabled) => setSettings({ ...settings, enabled })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="ai-test-mode">{t('testModeLabel')}</Label>
          <Switch
            id="ai-test-mode"
            checked={settings.test_mode}
            onCheckedChange={(test_mode) => setSettings({ ...settings, test_mode })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="ai-streaming">{t('streamingLabel')}</Label>
          <Switch
            id="ai-streaming"
            checked={settings.default_streaming}
            onCheckedChange={(default_streaming) => setSettings({ ...settings, default_streaming })}
          />
        </div>
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {t('saveSettings')}
        </Button>
      </TabsContent>
      <TabsContent value="models" className="space-y-3 pt-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="ai-model-fast">{t('fastModel')}</Label>
            <Select
              value={settings.model_fast}
              onValueChange={(value) => setSettings({ ...settings, model_fast: value })}
              disabled={loadingModels || modelOptions.length === 0}
            >
              <SelectTrigger id="ai-model-fast" className="w-[260px]">
                <SelectValue placeholder={t('chooseModel')} />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((option) => (
                  <SelectItem key={`fast-${option.value}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="ai-model-reasoning">{t('reasoningModel')}</Label>
            <Select
              value={settings.model_reasoning}
              onValueChange={(value) => setSettings({ ...settings, model_reasoning: value })}
              disabled={loadingModels || modelOptions.length === 0}
            >
              <SelectTrigger id="ai-model-reasoning" className="w-[260px]">
                <SelectValue placeholder={t('chooseModel')} />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((option) => (
                  <SelectItem key={`reasoning-${option.value}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loadingModels ? (
            <p className="text-sm text-muted-foreground">{t('loadingModels')}</p>
          ) : (
            <Button type="button" onClick={() => void fetchModels()} size="sm">
              {t('refreshModels')}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {t('saveSettings')}
          </Button>
          <Button type="button" onClick={() => void testConnection()} disabled={testing}>
            {testing ? t('testing') : t('testConnection')}
          </Button>
        </div>
      </TabsContent>
      <TabsContent value="tokens" className="space-y-2 pt-4">
        <p className="text-sm">{t('todayTokens', { count: today })}</p>
        <p className="text-sm">{t('monthTokens', { count: month })}</p>
      </TabsContent>
      <TabsContent value="diagnostics" className="space-y-2 pt-4">
        {diagnostics.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noDiagnostics')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {diagnostics.map((row) => (
              <li key={row.id}>
                {row.error_reference} — {row.classification ?? '—'}
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="health" className="space-y-3 pt-4">
        <p className="text-sm">{lastTestOk ? t('testConnection') : t('statusFailed')}</p>
        {lastTestSteps.length > 0 && (
          <ul className="space-y-2 text-sm">
            {lastTestSteps.map((step) => (
              <li key={step.step} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <code>{step.step}</code>
                  <span>{step.ok ? 'OK' : (step.error_code ?? t('statusFailed'))}</span>
                </div>
                {step.detail && <p className="mt-1 text-muted-foreground">{step.detail}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{step.latency_ms} ms</p>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  )
}
