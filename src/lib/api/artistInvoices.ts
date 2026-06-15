import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type InvoiceRow = Database['public']['Tables']['artist_invoices']['Row']
type InvoiceStatus = InvoiceRow['status']

export interface InvoiceLineItem {
  description: string
  qty: number
  unit_price_cents: number
}

export interface ArtistInvoice {
  id: string
  artistId: string
  invoiceNumber: string
  artistInvoiceNumber: string | undefined
  statementId: string | undefined
  clientName: string
  clientEmail: string
  clientAddress: string | undefined
  lineItems: InvoiceLineItem[]
  currency: string
  taxRatePct: number
  status: InvoiceStatus
  dueDate: string
  issuedDate: string
  notes: string | undefined
  pdfUrl: string | undefined
  createdAt: string
  updatedAt: string
}

export interface CreateInvoiceData {
  artistId: string
  invoiceNumber: string
  artistInvoiceNumber?: string
  clientName: string
  clientEmail: string
  clientAddress?: string
  lineItems: InvoiceLineItem[]
  currency?: string
  taxRatePct?: number
  dueDate: string
  issuedDate: string
  notes?: string
}

export interface CreateSosLinkedInvoiceData extends CreateInvoiceData {
  statementId: string
}

function rowToArtistInvoice(row: InvoiceRow): ArtistInvoice {
  return {
    id: row.id,
    artistId: row.artist_id,
    invoiceNumber: row.invoice_number,
    artistInvoiceNumber: row.artist_invoice_number ?? undefined,
    statementId: row.statement_id ?? undefined,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientAddress: row.client_address ?? undefined,
    lineItems: Array.isArray(row.line_items) ? row.line_items : [],
    currency: row.currency ?? 'EUR',
    taxRatePct: Number(row.tax_rate_pct ?? 19),
    status: row.status ?? 'draft',
    dueDate: row.due_date ?? '',
    issuedDate: row.issued_date ?? '',
    notes: row.notes ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normaliseOptional(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

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

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to get invoice: ${error.message}`)
  }

  return rowToArtistInvoice(data)
}

export async function getArtistInvoiceByStatementId(
  supabase: DbClient,
  artistId: string,
  statementId: string,
): Promise<ArtistInvoice | null> {
  const { data, error } = await supabase
    .from('artist_invoices')
    .select('*')
    .eq('artist_id', artistId)
    .eq('statement_id', statementId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to get linked invoice: ${error.message}`)
  }

  return rowToArtistInvoice(data)
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
      artist_invoice_number: normaliseOptional(data.artistInvoiceNumber),
      client_name: data.clientName,
      client_email: data.clientEmail,
      client_address: normaliseOptional(data.clientAddress),
      line_items: data.lineItems,
      currency: data.currency ?? 'EUR',
      tax_rate_pct: data.taxRatePct ?? 19.0,
      due_date: data.dueDate,
      issued_date: data.issuedDate,
      notes: normaliseOptional(data.notes),
      status: 'draft',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create invoice: ${error.message}`)
  return rowToArtistInvoice(row)
}

export async function createSosLinkedInvoice(
  supabase: DbClient,
  data: CreateSosLinkedInvoiceData,
): Promise<ArtistInvoice> {
  const { data: row, error } = await supabase
    .from('artist_invoices')
    .insert({
      artist_id: data.artistId,
      invoice_number: data.invoiceNumber,
      artist_invoice_number: normaliseOptional(data.artistInvoiceNumber),
      statement_id: data.statementId,
      client_name: data.clientName,
      client_email: data.clientEmail,
      client_address: normaliseOptional(data.clientAddress),
      line_items: data.lineItems,
      currency: data.currency ?? 'EUR',
      tax_rate_pct: data.taxRatePct ?? 19.0,
      due_date: data.dueDate,
      issued_date: data.issuedDate,
      notes: normaliseOptional(data.notes),
      status: 'draft',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create linked invoice: ${error.message}`)
  return rowToArtistInvoice(row)
}

export async function updateInvoice(
  supabase: DbClient,
  id: string,
  artistId: string,
  updates: Partial<{
    status: InvoiceStatus
    pdf_url: string
    notes: string | null
    artist_invoice_number: string | null
  }>,
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
