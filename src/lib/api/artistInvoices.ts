/**
 * src/lib/api/artistInvoices.ts
 *
 * Data Access Layer for the `artist_invoices` table.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type InvoiceRow = Database['public']['Tables']['artist_invoices']['Row']

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface InvoiceLineItem {
  description: string
  qty: number
  unit_price_cents: number
}

export interface ArtistInvoice {
  id: string
  artistId: string
  invoiceNumber: string
  clientName: string
  clientEmail: string
  clientAddress: string | undefined
  lineItems: InvoiceLineItem[]
  currency: string
  taxRatePct: number
  status: string
  dueDate: string
  issuedDate: string
  pdfUrl: string | undefined
  createdAt: string
  updatedAt: string
}

function rowToArtistInvoice(row: InvoiceRow): ArtistInvoice {
  const lineItems: InvoiceLineItem[] = Array.isArray(row.line_items)
    ? (row.line_items as unknown as InvoiceLineItem[])
    : []
  return {
    id: row.id,
    artistId: row.artist_id,
    invoiceNumber: row.invoice_number,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientAddress: row.client_address ?? undefined,
    lineItems,
    currency: row.currency ?? 'EUR',
    taxRatePct: Number(row.tax_rate_pct ?? 19),
    status: row.status ?? 'draft',
    dueDate: row.due_date ?? '',
    issuedDate: row.issued_date ?? '',
    pdfUrl: row.pdf_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listArtistInvoices(
  supabase: DbClient,
  artistId: string,
  page = 1,
  pageSize = 20,
): Promise<{ invoices: ArtistInvoice[]; total: number }> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('artist_invoices')
    .select('*', { count: 'exact' })
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(`Failed to list invoices: ${error.message}`)
  return {
    invoices: (data ?? []).map(rowToArtistInvoice),
    total: count ?? 0,
  }
}

export async function getArtistInvoice(
  supabase: DbClient,
  id: string,
  artistId: string,
): Promise<ArtistInvoice | null> {
  const { data, error } = await supabase
    .from('artist_invoices')
    .select('*')
    .eq('id', id)
    .eq('artist_id', artistId)
    .single()

  if (error) return null
  return rowToArtistInvoice(data)
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface CreateInvoiceData {
  artistId: string
  invoiceNumber: string
  clientName: string
  clientEmail: string
  clientAddress?: string
  lineItems: InvoiceLineItem[]
  currency?: string
  taxRatePct?: number
  dueDate: string
  issuedDate: string
}

export async function createArtistInvoice(
  supabase: DbClient,
  data: CreateInvoiceData,
): Promise<ArtistInvoice> {
  const { data: row, error } = await supabase
    .from('artist_invoices')
    .insert({
      artist_id: data.artistId,
      invoice_number: data.invoiceNumber,
      client_name: data.clientName,
      client_email: data.clientEmail,
      client_address: data.clientAddress ?? null,
      line_items: data.lineItems as unknown as Database['public']['Tables']['artist_invoices']['Insert']['line_items'],
      currency: data.currency ?? 'EUR',
      tax_rate_pct: data.taxRatePct ?? 19.0,
      due_date: data.dueDate,
      issued_date: data.issuedDate,
      status: 'draft',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create invoice: ${error.message}`)
  return rowToArtistInvoice(row)
}

export async function updateInvoice(
  supabase: DbClient,
  id: string,
  artistId: string,
  updates: Partial<{ status: 'draft' | 'sent' | 'paid' | 'cancelled'; pdf_url: string }>,
): Promise<ArtistInvoice> {
  const { data: row, error } = await supabase
    .from('artist_invoices')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('artist_id', artistId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update invoice: ${error.message}`)
  return rowToArtistInvoice(row)
}
