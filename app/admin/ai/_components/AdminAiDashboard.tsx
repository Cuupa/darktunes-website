'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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

  const load = useCallback(async () => {
    const headers = await authHeaders()
    const [settingsRes, usageRes, diagRes] = await Promise.all([
      fetch('/api/admin/ai/settings', { headers }),
      fetch('/api/admin/ai/usage', { headers }),
      fetch('/api/admin/ai/diagnostics', { headers }),
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
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const lastTestOk = useMemo(() => {
    const last = settings?.last_connection_test
    return last && last.ok === true
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
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setTesting(false)
    }
  }

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
        <p className="text-sm">
          {t('fastModel')}: {settings.model_fast}
        </p>
        <p className="text-sm">
          {t('reasoningModel')}: {settings.model_reasoning}
        </p>
        <Button type="button" onClick={() => void testConnection()} disabled={testing}>
          {testing ? t('testing') : t('testConnection')}
        </Button>
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
      <TabsContent value="health" className="space-y-2 pt-4">
        <p className="text-sm">{lastTestOk ? t('testConnection') : t('notConfigured')}</p>
      </TabsContent>
    </Tabs>
  )
}
