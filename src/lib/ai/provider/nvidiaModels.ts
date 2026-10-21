import { NVIDIA_API_BASE_URL } from '@/lib/ai/types/provider'

export const NVIDIA_MODELS_URL = `${NVIDIA_API_BASE_URL}/models`

export interface NvidiaListedModel {
  id: string
  name: string
}

export function parseNvidiaModelsList(payload: unknown): NvidiaListedModel[] {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) return []
  const models: NvidiaListedModel[] = []
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const id = (item as { id?: unknown }).id
    if (typeof id !== 'string' || id.length === 0) continue
    const name = (item as { name?: unknown }).name
    models.push({ id, name: typeof name === 'string' ? name : '' })
  }
  return models
}
