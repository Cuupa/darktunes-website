'use client'

import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { TemporalState } from 'zundo'
import { createFanPageEditorStore, type FanPageEditorStore } from './store'
import type { LandingPageDocumentV1 } from '@/lib/fan-page/schema/documentV1'

type FanPageEditorStoreApi = ReturnType<typeof createFanPageEditorStore>
type FanPageTemporalState = TemporalState<Pick<FanPageEditorStore, 'document'>>

const FanPageEditorContext = createContext<FanPageEditorStoreApi | null>(null)

export function FanPageEditorProvider({
  initialDocument,
  children,
}: {
  initialDocument: LandingPageDocumentV1
  children: ReactNode
}) {
  const storeRef = useRef<FanPageEditorStoreApi | null>(null)
  if (!storeRef.current) {
    storeRef.current = createFanPageEditorStore(initialDocument)
  }

  return (
    <FanPageEditorContext.Provider value={storeRef.current}>{children}</FanPageEditorContext.Provider>
  )
}

export function useFanPageEditorStore<T>(selector: (state: FanPageEditorStore) => T): T {
  const store = useContext(FanPageEditorContext)
  if (!store) throw new Error('useFanPageEditorStore must be used within FanPageEditorProvider')
  return useStore(store, selector)
}

export function useFanPageEditorStoreApi(): FanPageEditorStoreApi {
  const store = useContext(FanPageEditorContext)
  if (!store) throw new Error('useFanPageEditorStoreApi must be used within FanPageEditorProvider')
  return store
}

export function useFanPageEditorTemporal(): FanPageTemporalState
export function useFanPageEditorTemporal<T>(selector: (state: FanPageTemporalState) => T): T
export function useFanPageEditorTemporal<T>(
  selector?: (state: FanPageTemporalState) => T,
): T | FanPageTemporalState {
  const store = useFanPageEditorStoreApi()
  return useStore(store.temporal, selector ?? ((state) => state as T | FanPageTemporalState))
}