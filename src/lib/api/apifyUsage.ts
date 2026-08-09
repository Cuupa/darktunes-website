/**
 * DAL for apify_usage_months — monthly billable URL counter for free tier.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { APIFY_MONTHLY_URL_BUDGET } from '@/lib/analytics/apifySpotifyPlayCountClient'

type DbClient = SupabaseClient<Database>

export interface ApifyUsageMonth {
  yearMonth: string
  urlsCharged: number
  budget: number
  updatedAt: string
}

export async function getApifyUsageMonth(
  db: DbClient,
  yearMonth: string,
): Promise<ApifyUsageMonth> {
  const { data, error } = await db
    .from('apify_usage_months')
    .select('*')
    .eq('year_month', yearMonth)
    .maybeSingle()

  if (error) throw new Error(error.message)

  if (!data) {
    return {
      yearMonth,
      urlsCharged: 0,
      budget: APIFY_MONTHLY_URL_BUDGET,
      updatedAt: new Date(0).toISOString(),
    }
  }

  return {
    yearMonth: data.year_month,
    urlsCharged: data.urls_charged,
    budget: data.budget,
    updatedAt: data.updated_at,
  }
}

/**
 * Atomically increments urls_charged for the month (upsert).
 * Caller must ensure budget was checked beforehand.
 */
export async function incrementApifyUsage(
  db: DbClient,
  yearMonth: string,
  delta: number,
  budget: number = APIFY_MONTHLY_URL_BUDGET,
): Promise<ApifyUsageMonth> {
  if (delta <= 0) return getApifyUsageMonth(db, yearMonth)

  const current = await getApifyUsageMonth(db, yearMonth)
  const next = current.urlsCharged + delta
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('apify_usage_months')
    .upsert(
      {
        year_month: yearMonth,
        urls_charged: next,
        budget: current.budget || budget,
        updated_at: now,
      },
      { onConflict: 'year_month' },
    )
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  return {
    yearMonth: data.year_month,
    urlsCharged: data.urls_charged,
    budget: data.budget,
    updatedAt: data.updated_at,
  }
}
