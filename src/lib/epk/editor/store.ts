/**
 * src/lib/epk/editor/store.ts
 *
 * Zustand + Immer + zundo temporal store for the EPK canvas editor.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { temporal } from 'zundo'
import type { EpkDocumentV2, EpkElement, EpkFont, EpkPageBackground } from '@/lib/epk/schema/documentV2'
import type { EpkGradient } from '@/lib/epk/gradients'
import { createEpkElementId, createEpkPageId } from '@/lib/epk/schema/elementIds'
import { getPageDimensions } from '@/lib/epk/schema/pageDimensions'
import { createDefaultElement, getNextZIndex } from './defaults'
import { snapValue } from '@/lib/epk/textLayout'
import { createGroupFromElements, getGroupChildren } from '@/lib/epk/elements/groupUtils'

export interface EpkEditorState {
  document: EpkDocumentV2
  selectedIds: string[]
  zoom: number
  activePageId: string
  isDirty: boolean
  snapEnabled: boolean
  showGrid: boolean
  gridSize: number
}

export interface EpkEditorActions {
  setDocument: (document: EpkDocumentV2) => void
  applyDocument: (document: EpkDocumentV2) => void
  markClean: () => void
  selectElements: (ids: string[]) => void
  clearSelection: () => void
  setZoom: (zoom: number) => void
  setSnapEnabled: (enabled: boolean) => void
  setShowGrid: (show: boolean) => void
  setGridSize: (size: number) => void
  setActivePageId: (pageId: string) => void
  duplicateSelected: () => void
  nudgeSelected: (dx: number, dy: number) => void
  addPresetElement: (element: EpkElement) => void
  updateElement: (id: string, patch: Partial<EpkElement>) => void
  addElement: (type: EpkElement['type'], overrides?: Partial<EpkElement>) => string
  deleteSelected: () => void
  moveElementZ: (id: string, direction: 'up' | 'down' | 'front' | 'back') => void
  reorderElementLayers: (orderedIds: string[]) => void
  toggleElementVisibility: (id: string) => void
  toggleElementLock: (id: string) => void
  addPage: (name?: string) => string
  removePage: (pageId: string) => void
  duplicatePage: (pageId: string) => string
  renamePage: (pageId: string, name: string) => void
  addDocumentFont: (font: EpkFont) => void
  removeDocumentFont: (fontId: string) => void
  groupSelected: () => void
  ungroupSelected: () => void
  moveGroupByDelta: (groupId: string, dx: number, dy: number) => void
  updatePageBackground: (pageId: string, background: EpkPageBackground) => void
  alignSelected: (mode: 'center' | 'center-h' | 'center-v') => void
  applyGradientToSelected: (gradient: EpkGradient) => void
  toggleSelectedFlip: (axis: 'x' | 'y') => void
}

export type EpkEditorStore = EpkEditorState & EpkEditorActions

function reorderZIndex(elements: EpkElement[], pageId: string): EpkElement[] {
  const pageElements = elements
    .filter((el) => el.pageId === pageId)
    .sort((a, b) => a.zIndex - b.zIndex)

  const zMap = new Map<string, number>()
  pageElements.forEach((el, index) => zMap.set(el.id, index + 1))

  return elements.map((el) =>
    el.pageId === pageId && zMap.has(el.id)
      ? { ...el, zIndex: zMap.get(el.id) ?? el.zIndex }
      : el,
  )
}

export function createEpkEditorStore(initialDocument: EpkDocumentV2) {
  const activePageId = initialDocument.pages[0]?.id ?? ''

  return create<EpkEditorStore>()(
    temporal(
      immer((set, get) => ({
        document: initialDocument,
        selectedIds: [],
        zoom: 0.75,
        activePageId,
        isDirty: false,
        snapEnabled: true,
        showGrid: true,
        gridSize: 16,

        setDocument: (document) =>
          set((state) => {
            state.document = document
            if (!document.pages.some((p) => p.id === state.activePageId)) {
              state.activePageId = document.pages[0]?.id ?? ''
            }
            state.isDirty = false
          }),

        applyDocument: (document) =>
          set((state) => {
            state.document = document
            state.activePageId = document.pages[0]?.id ?? ''
            state.selectedIds = []
            state.isDirty = true
          }),

        markClean: () =>
          set((state) => {
            state.isDirty = false
          }),

        selectElements: (ids) =>
          set((state) => {
            state.selectedIds = ids
          }),

        clearSelection: () =>
          set((state) => {
            state.selectedIds = []
          }),

        setZoom: (zoom) =>
          set((state) => {
            state.zoom = Math.min(3, Math.max(0.1, zoom))
          }),

        setSnapEnabled: (enabled) =>
          set((state) => {
            state.snapEnabled = enabled
          }),

        setShowGrid: (show) =>
          set((state) => {
            state.showGrid = show
          }),

        setGridSize: (size) =>
          set((state) => {
            state.gridSize = Math.max(4, Math.min(64, size))
          }),

        setActivePageId: (pageId) =>
          set((state) => {
            state.activePageId = pageId
            state.selectedIds = []
          }),

        updateElement: (id, patch) =>
          set((state) => {
            const index = state.document.elements.findIndex((el) => el.id === id)
            if (index === -1) return
            const el = state.document.elements[index]
            const next = { ...patch }
            if (state.snapEnabled) {
              if (typeof next.x === 'number') next.x = snapValue(next.x, state.gridSize, true)
              if (typeof next.y === 'number') next.y = snapValue(next.y, state.gridSize, true)
            }
            if (next.style) {
              el.style = { ...el.style, ...next.style }
              delete next.style
            }
            Object.assign(el, next)
            state.isDirty = true
          }),

        duplicateSelected: () =>
          set((state) => {
            if (state.selectedIds.length === 0) return
            const newIds: string[] = []
            for (const id of state.selectedIds) {
              const source = state.document.elements.find((el) => el.id === id)
              if (!source || source.type === 'group') continue
              const clone: EpkElement = {
                ...source,
                id: createEpkElementId(source.type),
                x: source.x + 16,
                y: source.y + 16,
                zIndex: getNextZIndex(state.document, state.activePageId),
              }
              state.document.elements.push(clone)
              newIds.push(clone.id)
            }
            if (newIds.length > 0) state.selectedIds = newIds
            state.isDirty = true
          }),

        nudgeSelected: (dx, dy) =>
          set((state) => {
            if (state.selectedIds.length === 0) return
            for (const id of state.selectedIds) {
              const el = state.document.elements.find((e) => e.id === id)
              if (!el || el.locked) continue
              el.x = snapValue(el.x + dx, state.gridSize, state.snapEnabled)
              el.y = snapValue(el.y + dy, state.gridSize, state.snapEnabled)
            }
            state.isDirty = true
          }),

        addPresetElement: (element) =>
          set((state) => {
            state.document.elements.push(element)
            state.selectedIds = [element.id]
            state.isDirty = true
          }),

        addElement: (type, overrides) => {
          const element = createDefaultElement(
            type,
            get().activePageId,
            get().document,
            overrides,
          )
          set((state) => {
            state.document.elements.push(element)
            state.selectedIds = [element.id]
            state.isDirty = true
          })
          return element.id
        },

        deleteSelected: () =>
          set((state) => {
            if (state.selectedIds.length === 0) return
            const remove = new Set(state.selectedIds)

            for (const id of state.selectedIds) {
              const element = state.document.elements.find((el) => el.id === id)
              if (element?.type === 'group' && element.children) {
                for (const childId of element.children) remove.add(childId)
              }
            }

            state.document.elements = state.document.elements.filter((el) => !remove.has(el.id))
            state.selectedIds = []
            state.isDirty = true
          }),

        moveElementZ: (id, direction) =>
          set((state) => {
            const pageId = state.activePageId
            const sorted = state.document.elements
              .filter((el) => el.pageId === pageId)
              .sort((a, b) => a.zIndex - b.zIndex)
            const index = sorted.findIndex((el) => el.id === id)
            if (index === -1) return

            let swapWith = -1
            if (direction === 'up' || direction === 'front') swapWith = direction === 'front' ? sorted.length - 1 : index + 1
            if (direction === 'down' || direction === 'back') swapWith = direction === 'back' ? 0 : index - 1

            if (swapWith < 0 || swapWith >= sorted.length || swapWith === index) {
              if (direction === 'front') {
                sorted.forEach((el, i) => {
                  const target = state.document.elements.find((e) => e.id === el.id)
                  if (target) target.zIndex = i + 1
                })
                const target = state.document.elements.find((e) => e.id === id)
                if (target) target.zIndex = sorted.length
              } else if (direction === 'back') {
                sorted.forEach((el, i) => {
                  const target = state.document.elements.find((e) => e.id === el.id)
                  if (target) target.zIndex = i + 2
                })
                const target = state.document.elements.find((e) => e.id === id)
                if (target) target.zIndex = 1
              }
            } else {
              const a = sorted[index]
              const b = sorted[swapWith]
              const elA = state.document.elements.find((e) => e.id === a.id)
              const elB = state.document.elements.find((e) => e.id === b.id)
              if (elA && elB) {
                const tmp = elA.zIndex
                elA.zIndex = elB.zIndex
                elB.zIndex = tmp
              }
            }

            state.document.elements = reorderZIndex(state.document.elements, pageId)
            state.isDirty = true
          }),

        reorderElementLayers: (orderedIds) =>
          set((state) => {
            const pageId = state.activePageId
            const pageElements = state.document.elements.filter((el) => el.pageId === pageId)
            if (orderedIds.length !== pageElements.length) return
            if (!orderedIds.every((id) => pageElements.some((el) => el.id === id))) return

            orderedIds.forEach((id, visualIndex) => {
              const el = state.document.elements.find((e) => e.id === id)
              if (el) el.zIndex = orderedIds.length - visualIndex
            })

            state.document.elements = reorderZIndex(state.document.elements, pageId)
            state.isDirty = true
          }),

        toggleElementVisibility: (id) =>
          set((state) => {
            const el = state.document.elements.find((e) => e.id === id)
            if (!el) return
            el.visible = !el.visible
            state.isDirty = true
          }),

        toggleElementLock: (id) =>
          set((state) => {
            const el = state.document.elements.find((e) => e.id === id)
            if (!el) return
            el.locked = !el.locked
            state.isDirty = true
          }),

        addPage: (name) => {
          const doc = get().document
          const dims = getPageDimensions(doc.pageFormat, doc.orientation)
          const pageIndex = doc.pages.length
          const pageId = createEpkPageId(pageIndex)
          const refPage = doc.pages[0]

          set((state) => {
            state.document.pages.push({
              id: pageId,
              name: name ?? `Page ${pageIndex + 1}`,
              width: dims.width,
              height: dims.height,
              background: refPage?.background ?? { type: 'color', color: '#101010' },
            })
            state.activePageId = pageId
            state.selectedIds = []
            state.isDirty = true
          })
          return pageId
        },

        removePage: (pageId) =>
          set((state) => {
            if (state.document.pages.length <= 1) return
            state.document.pages = state.document.pages.filter((p) => p.id !== pageId)
            state.document.elements = state.document.elements.filter((el) => el.pageId !== pageId)
            if (state.activePageId === pageId) {
              state.activePageId = state.document.pages[0]?.id ?? ''
            }
            state.selectedIds = []
            state.isDirty = true
          }),

        duplicatePage: (pageId) => {
          const sourcePage = get().document.pages.find((p) => p.id === pageId)
          if (!sourcePage) return ''

          const newPageId = createEpkPageId(get().document.pages.length)
          const newPageName = `${sourcePage.name ?? 'Page'} copy`

          set((state) => {
            state.document.pages.push({
              ...sourcePage,
              id: newPageId,
              name: newPageName,
            })

            const sourceElements = state.document.elements.filter((el) => el.pageId === pageId)
            for (const el of sourceElements) {
              state.document.elements.push({
                ...el,
                id: createEpkElementId(el.type),
                pageId: newPageId,
              })
            }

            state.activePageId = newPageId
            state.selectedIds = []
            state.isDirty = true
          })
          return newPageId
        },

        renamePage: (pageId, name) =>
          set((state) => {
            const page = state.document.pages.find((p) => p.id === pageId)
            if (!page) return
            page.name = name
            state.isDirty = true
          }),

        addDocumentFont: (font) =>
          set((state) => {
            const exists = state.document.fonts.some((f) => f.id === font.id)
            if (!exists) state.document.fonts.push(font)
            state.isDirty = true
          }),

        removeDocumentFont: (fontId) =>
          set((state) => {
            state.document.fonts = state.document.fonts.filter((f) => f.id !== fontId)
            state.isDirty = true
          }),

        groupSelected: () =>
          set((state) => {
            if (state.selectedIds.length < 2) return
            const group = createGroupFromElements(
              state.document,
              state.activePageId,
              state.selectedIds,
            )
            if (!group) return
            state.document.elements.push(group)
            state.selectedIds = [group.id]
            state.isDirty = true
          }),

        ungroupSelected: () =>
          set((state) => {
            const groupId = state.selectedIds.find((id) => {
              const el = state.document.elements.find((e) => e.id === id)
              return el?.type === 'group'
            })
            if (!groupId) return

            const group = state.document.elements.find((el) => el.id === groupId)
            if (!group || group.type !== 'group') return

            const childIds = group.children ?? []
            state.document.elements = state.document.elements.filter((el) => el.id !== groupId)
            state.selectedIds = childIds
            state.isDirty = true
          }),

        moveGroupByDelta: (groupId, dx, dy) =>
          set((state) => {
            const group = state.document.elements.find((el) => el.id === groupId)
            if (!group || group.type !== 'group') return

            group.x += dx
            group.y += dy

            for (const child of getGroupChildren(state.document, group)) {
              child.x += dx
              child.y += dy
            }

            state.isDirty = true
          }),

        updatePageBackground: (pageId, background) =>
          set((state) => {
            const page = state.document.pages.find((p) => p.id === pageId)
            if (!page) return
            page.background = background
            state.isDirty = true
          }),

        alignSelected: (mode) =>
          set((state) => {
            const page = state.document.pages.find((p) => p.id === state.activePageId)
            if (!page || state.selectedIds.length === 0) return
            for (const id of state.selectedIds) {
              const el = state.document.elements.find((e) => e.id === id)
              if (!el || el.locked) continue
              if (mode === 'center' || mode === 'center-h') {
                el.x = snapValue((page.width - el.width) / 2, state.gridSize, state.snapEnabled)
              }
              if (mode === 'center' || mode === 'center-v') {
                el.y = snapValue((page.height - el.height) / 2, state.gridSize, state.snapEnabled)
              }
            }
            state.isDirty = true
          }),

        applyGradientToSelected: (gradient) =>
          set((state) => {
            if (state.selectedIds.length === 0) return
            for (const id of state.selectedIds) {
              const el = state.document.elements.find((e) => e.id === id)
              if (!el || el.type !== 'shape') continue
              el.style = {
                ...el.style,
                fillType: 'gradient',
                gradientStops: gradient.stops,
                gradientAngle: gradient.angle,
              }
            }
            state.isDirty = true
          }),

        toggleSelectedFlip: (axis) =>
          set((state) => {
            if (state.selectedIds.length !== 1) return
            const el = state.document.elements.find((e) => e.id === state.selectedIds[0])
            if (!el || (el.type !== 'image' && el.type !== 'logo')) return
            if (axis === 'x') el.flipX = !el.flipX
            else el.flipY = !el.flipY
            state.isDirty = true
          }),
      })),
      {
        limit: 50,
        partialize: (state) => ({ document: state.document }),
        equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
      },
    ),
  )
}

export type EpkEditorStoreApi = ReturnType<typeof createEpkEditorStore>