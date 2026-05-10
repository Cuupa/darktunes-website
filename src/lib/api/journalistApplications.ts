/**
 * src/lib/api/journalistApplications.ts
 *
 * Data Access Layer for the `journalist_applications` table.
 *
 * Journalists apply for promo-pool access by submitting an application.
 * The label admin reviews the application and approves/rejects it.
 * On approval the caller upgrades the user's `profiles.role` to 'journalist'.
 *
 * RLS:
 *   - Users can INSERT their own application and SELECT it back.
 *   - Admins can SELECT/UPDATE all applications (via service-role client).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type ApplicationRow = Database['public']['Tables']['journalist_applications']['Row']
type ApplicationInsert = Database['public']['Tables']['journalist_applications']['Insert']

// ---------------------------------------------------------------------------
// Domain type
// ---------------------------------------------------------------------------

export interface JournalistApplication {
  id: string
  userId: string | undefined
  email: string
  name: string
  outlet: string
  message: string | undefined
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy: string | undefined
  reviewedAt: string | undefined
  createdAt: string
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToApplication(row: ApplicationRow): JournalistApplication {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    email: row.email,
    name: row.name,
    outlet: row.outlet,
    message: row.message ?? undefined,
    status: row.status,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetches all applications, newest first. Admin/service-role client required. */
export async function getJournalistApplications(
  db: DbClient,
): Promise<JournalistApplication[]> {
  const { data, error } = await db
    .from('journalist_applications')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToApplication(row as ApplicationRow))
}

/**
 * Fetches the most recent application for a given user.
 * Returns null if no application exists (PGRST116).
 */
export async function getJournalistApplicationByUserId(
  db: DbClient,
  userId: string,
): Promise<JournalistApplication | null> {
  const { data, error } = await db
    .from('journalist_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }

  return data ? rowToApplication(data as ApplicationRow) : null
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Inserts a new journalist application.
 * The user_id must match the authenticated caller (enforced by RLS).
 */
export async function createJournalistApplication(
  db: DbClient,
  application: ApplicationInsert,
): Promise<JournalistApplication> {
  const { data, error } = await db
    .from('journalist_applications')
    .insert(application)
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createJournalistApplication')
  return rowToApplication(data as ApplicationRow)
}

/**
 * Updates an application's status to 'approved' or 'rejected'.
 * Must be called with an admin/service-role client.
 * The reviewed_by and reviewed_at fields are set automatically.
 */
export async function updateApplicationStatus(
  db: DbClient,
  id: string,
  status: 'approved' | 'rejected',
  reviewedBy: string,
): Promise<JournalistApplication> {
  const { data, error } = await db
    .from('journalist_applications')
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from updateApplicationStatus')
  return rowToApplication(data as ApplicationRow)
}
