import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { FeatureToggles } from '@/types'

type DbClient = SupabaseClient<Database>

export const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  promoPool: true,
  editorTools: true,
}

/** Parse the `feature_toggles` JSON value from site_settings. */
export function parseFeatureTogglesJson(raw: string | null | undefined): FeatureToggles {
  try {
    const parsed = JSON.parse(raw ?? '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const candidate = parsed as Record<string, unknown>
      return {
        promoPool:
          typeof candidate.promoPool === 'boolean'
            ? candidate.promoPool
            : DEFAULT_FEATURE_TOGGLES.promoPool,
        editorTools:
          typeof candidate.editorTools === 'boolean'
            ? candidate.editorTools
            : DEFAULT_FEATURE_TOGGLES.editorTools,
      }
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_FEATURE_TOGGLES }
}

export async function getFeatureToggles(db: DbClient): Promise<FeatureToggles> {
  const { data, error } = await db
    .from('site_settings')
    .select('value')
    .eq('key', 'feature_toggles')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return parseFeatureTogglesJson(data?.value)
}