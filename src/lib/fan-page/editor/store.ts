/**
 * Zustand + Immer + zundo store for the Fan Page section editor.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { temporal } from 'zundo'
import type { LandingPageDocumentV1, FanPageBlockType, FanPageSection } from '@/lib/fan-page/schema/documentV1'
import { createSectionId } from '@/lib/fan-page/schema/documentV1'
import { reorderSections } from '@/lib/fan-page/layout/autoLayout'
import { autoLayoutForMobile } from '@/lib/fan-page/layout/autoLayout'

export type FanPageDevice = 'desktop' | 'mobile'

export interface FanPageEditorState {
  document: LandingPageDocumentV1
  selectedSectionId: string | null
  previewDevice: FanPageDevice
  isDirty: boolean
}

export interface FanPageEditorActions {
  setDocument: (document: LandingPageDocumentV1) => void
  applyDocument: (document: LandingPageDocumentV1) => void
  markClean: () => void
  selectSection: (id: string | null) => void
  setPreviewDevice: (device: FanPageDevice) => void
  addSection: (type: FanPageBlockType, afterId?: string) => string
  updateSection: (id: string, patch: Partial<FanPageSection>) => void
  updateSectionProps: (id: string, props: Record<string, unknown>) => void
  removeSection: (id: string) => void
  reorderSection: (activeId: string, overId: string) => void
  applyThemePalette: (paletteId: string) => void
  setThemeCustomColor: (key: 'primary' | 'accent' | 'background', value: string) => void
  runAutoLayoutMobile: () => void
}

export type FanPageEditorStore = FanPageEditorState & FanPageEditorActions

function defaultPropsForBlock(type: FanPageBlockType): Record<string, unknown> {
  switch (type) {
    case 'hero':
      return { headline: '', subheadline: '' }
    case 'bio':
      return { content: '' }
    case 'cta_banner':
      return { label: 'Learn More', url: '' }
    case 'release_grid':
      return { limit: 6 }
    case 'video_grid':
      return { limit: 3 }
    case 'spacer':
      return { size: 'md' }
    default:
      return {}
  }
}

export function createFanPageEditorStore(initialDocument: LandingPageDocumentV1) {
  return create<FanPageEditorStore>()(
    temporal(
      immer((set) => ({
        document: initialDocument,
        selectedSectionId: initialDocument.sections[0]?.id ?? null,
        previewDevice: 'desktop',
        isDirty: false,

        setDocument: (document) =>
          set((state) => {
            state.document = document
            state.isDirty = true
          }),

        applyDocument: (document) =>
          set((state) => {
            state.document = document
            state.isDirty = false
          }),

        markClean: () =>
          set((state) => {
            state.isDirty = false
          }),

        selectSection: (id) =>
          set((state) => {
            state.selectedSectionId = id
          }),

        setPreviewDevice: (device) =>
          set((state) => {
            state.previewDevice = device
          }),

        addSection: (type, afterId) => {
          const id = createSectionId()
          set((state) => {
            const sorted = [...state.document.sections].sort((a, b) => a.order - b.order)
            const insertIndex = afterId
              ? sorted.findIndex((s) => s.id === afterId) + 1
              : sorted.length
            const newSection: FanPageSection = {
              id,
              type,
              order: insertIndex,
              props: defaultPropsForBlock(type),
              styles: { desktop: {} },
            }
            sorted.splice(insertIndex, 0, newSection)
            state.document.sections = sorted.map((s, i) => ({ ...s, order: i }))
            state.selectedSectionId = id
            state.isDirty = true
          })
          return id
        },

        updateSection: (sectionId, patch) =>
          set((state) => {
            const idx = state.document.sections.findIndex((s) => s.id === sectionId)
            if (idx < 0) return
            state.document.sections[idx] = { ...state.document.sections[idx], ...patch }
            state.isDirty = true
          }),

        updateSectionProps: (sectionId, props) =>
          set((state) => {
            const idx = state.document.sections.findIndex((s) => s.id === sectionId)
            if (idx < 0) return
            state.document.sections[idx].props = {
              ...state.document.sections[idx].props,
              ...props,
            }
            state.isDirty = true
          }),

        removeSection: (sectionId) =>
          set((state) => {
            state.document.sections = state.document.sections
              .filter((s) => s.id !== sectionId)
              .map((s, i) => ({ ...s, order: i }))
            if (state.selectedSectionId === sectionId) {
              state.selectedSectionId = state.document.sections[0]?.id ?? null
            }
            state.isDirty = true
          }),

        reorderSection: (activeId, overId) =>
          set((state) => {
            state.document.sections = reorderSections(state.document.sections, activeId, overId)
            state.isDirty = true
          }),

        applyThemePalette: (paletteId) =>
          set((state) => {
            state.document.theme.paletteId = paletteId
            state.isDirty = true
          }),

        setThemeCustomColor: (key, value) =>
          set((state) => {
            state.document.theme.customColors = {
              ...state.document.theme.customColors,
              [key]: value,
            }
            state.isDirty = true
          }),

        runAutoLayoutMobile: () =>
          set((state) => {
            state.document = autoLayoutForMobile(state.document)
            state.isDirty = true
          }),
      })),
      { limit: 100 },
    ),
  )
}