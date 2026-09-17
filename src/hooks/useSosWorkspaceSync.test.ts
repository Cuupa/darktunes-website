import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSosWorkspaceSync } from './useSosWorkspaceSync'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/i18n/accountingFallbacks', () => ({ useAccountingLabels: () => ({
  workspaceSaveError: 'save error',
  workspaceSaveFailed: 'save failed',
  workspaceDefaultSaveError: 'default save error',
  workspaceLoadFailed: 'load failed',
  workspaceLoadError: 'load error',
  workspaceSaveSuccess: 'saved',
  workspaceDefaultSaveSuccess: 'default saved',
}) }))
vi.mock('@/lib/sos/clientAppLog', () => ({ logClientAppEvent: vi.fn() }))
vi.mock('@/lib/sos/migrateKvToDb', () => ({
  clearLegacyKvKeys: vi.fn(),
  isKvMigrationComplete: vi.fn().mockReturnValue(true),
  markKvMigrationComplete: vi.fn(),
  mergeKvIntoSettings: vi.fn((s: unknown) => s),
  readLegacyKvSettings: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/sos/sosAccountingSettings', () => ({
  DEFAULT_SOS_ACCOUNTING_SETTINGS: { version: 1 },
  settingsFingerprint: vi.fn(() => 'fp'),
}))

describe('useSosWorkspaceSync', () => {
  it('exposes confirmation toggles and load action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))

    const { result } = renderHook(() => useSosWorkspaceSync({
      currentPeriodKey: null,
      settings: { version: 1 } as never,
      applySettings: vi.fn(),
      bronzeBatchIds: [],
      disabled: true,
    }))

    expect(result.current.reloadConfirmOpen).toBe(false)

    act(() => {
      result.current.setReloadConfirmOpen(true)
    })

    expect(result.current.reloadConfirmOpen).toBe(true)
  })

  it('persistImportedSettings writes the Default preset', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ preset: { updated_at: '2026-08-14T00:00:00.000Z' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useSosWorkspaceSync({
      currentPeriodKey: null,
      settings: { version: 1 } as never,
      applySettings: vi.fn(),
      bronzeBatchIds: [],
      disabled: true,
    }))

    await act(async () => {
      const ok = await result.current.persistImportedSettings({ version: 1 } as never)
      expect(ok).toBe(true)
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/sos/presets/default',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('sends the loaded revision, stores the returned one and reads bronze batch ids', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/admin/sos/workspaces?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            workspace: {
              config: { splitFees: [{ artist: 'A' }] },
              revision: 3,
              bronzeBatchIds: ['batch-1'],
              updated_at: '2026-01-01T00:00:00.000Z',
            },
          }),
        } as Response
      }
      if (url === '/api/admin/sos/workspaces' && init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            workspace: { revision: 4, updated_at: '2026-01-02T00:00:00.000Z' },
          }),
        } as Response
      }
      if (url === '/api/admin/sos/presets/default') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            preset: { config: {}, updated_at: '2026-01-01T00:00:00.000Z' },
          }),
        } as Response
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const periodKey = { start: '2026-01', end: '2026-03' }
    const applySettings = vi.fn()
    const { result } = renderHook(() => useSosWorkspaceSync({
      currentPeriodKey: periodKey,
      settings: { version: 1, splitFees: [], compilationFilters: [], artistMappings: [] } as never,
      applySettings,
      bronzeBatchIds: [],
      disabled: true,
    }))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.serverBronzeBatchIds).toEqual(['batch-1'])

    await act(async () => {
      const ok = await result.current.saveCurrentWorkspace()
      expect(ok).toBe(true)
    })

    const postCall = fetchMock.mock.calls.find(
      (call) =>
        String(call[0]) === '/api/admin/sos/workspaces' &&
        (call[1] as RequestInit | undefined)?.method === 'POST',
    )
    const body = JSON.parse(String((postCall?.[1] as RequestInit).body)) as {
      expected_revision?: number
    }
    expect(body.expected_revision).toBe(3)
  })

  it('keeps local changes dirty and blocks further saves after a 409 conflict', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/admin/sos/workspaces?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            workspace: {
              config: { splitFees: [{ artist: 'A' }] },
              revision: 2,
              bronzeBatchIds: [],
              updated_at: '2026-01-01T00:00:00.000Z',
            },
          }),
        } as Response
      }
      if (url === '/api/admin/sos/workspaces' && init?.method === 'POST') {
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: 'Workspace was changed by another session' }),
        } as Response
      }
      if (url === '/api/admin/sos/presets/default') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            preset: { config: {}, updated_at: '2026-01-01T00:00:00.000Z' },
          }),
        } as Response
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const periodKey = { start: '2026-01', end: '2026-03' }
    const applySettings = vi.fn()
    const { result } = renderHook(() => useSosWorkspaceSync({
      currentPeriodKey: periodKey,
      settings: { version: 1, splitFees: [], compilationFilters: [], artistMappings: [] } as never,
      applySettings,
      bronzeBatchIds: [],
      disabled: true,
    }))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      const ok = await result.current.saveCurrentWorkspace()
      expect(ok).toBe(false)
    })

    expect(result.current.workspaceConflict).toBe(true)

    const postsBefore = fetchMock.mock.calls.filter(
      (call) =>
        String(call[0]) === '/api/admin/sos/workspaces' &&
        (call[1] as RequestInit | undefined)?.method === 'POST',
    ).length

    await act(async () => {
      const ok = await result.current.saveCurrentWorkspace()
      expect(ok).toBe(false)
    })

    const postsAfter = fetchMock.mock.calls.filter(
      (call) =>
        String(call[0]) === '/api/admin/sos/workspaces' &&
        (call[1] as RequestInit | undefined)?.method === 'POST',
    ).length
    expect(postsAfter).toBe(postsBefore)
  })
})
