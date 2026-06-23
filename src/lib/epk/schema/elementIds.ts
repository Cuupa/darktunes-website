/**
 * src/lib/epk/schema/elementIds.ts
 *
 * Deterministic ID helpers for EPK document elements.
 */

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function createEpkElementId(prefix = 'el'): string {
  return `${prefix}_${createUuid()}`
}

export function createEpkPageId(index = 0): string {
  return `page_${index}_${createUuid().slice(0, 8)}`
}