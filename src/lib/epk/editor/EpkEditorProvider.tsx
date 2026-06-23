'use client'

/**
 * src/lib/epk/editor/EpkEditorProvider.tsx
 *
 * React context providing a per-session EPK editor Zustand store.
 */

import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { TemporalState } from 'zundo'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import {
  createEpkEditorStore,
  type EpkEditorStore,
  type EpkEditorStoreApi,
} from './store'

const EpkEditorContext = createContext<EpkEditorStoreApi | null>(null)

interface EpkEditorProviderProps {
  initialDocument: EpkDocumentV2
  children: ReactNode
}

export function EpkEditorProvider({ initialDocument, children }: EpkEditorProviderProps) {
  const storeRef = useRef<EpkEditorStoreApi | null>(null)
  if (!storeRef.current) {
    storeRef.current = createEpkEditorStore(initialDocument)
  }

  return (
    <EpkEditorContext.Provider value={storeRef.current}>
      {children}
    </EpkEditorContext.Provider>
  )
}

export function useEpkEditorStoreApi(): EpkEditorStoreApi {
  const store = useContext(EpkEditorContext)
  if (!store) {
    throw new Error('useEpkEditorStoreApi must be used within EpkEditorProvider')
  }
  return store
}

export function useEpkEditorStore<T>(selector: (state: EpkEditorStore) => T): T {
  const store = useEpkEditorStoreApi()
  return useStore(store, selector)
}

type EpkTemporalState = TemporalState<Pick<EpkEditorStore, 'document'>>

export function useEpkEditorTemporal(): EpkTemporalState
export function useEpkEditorTemporal<T>(selector: (state: EpkTemporalState) => T): T
export function useEpkEditorTemporal<T>(
  selector?: (state: EpkTemporalState) => T,
): T | EpkTemporalState {
  const store = useEpkEditorStoreApi()
  return useStore(store.temporal, selector ?? ((state) => state as T | EpkTemporalState))
}