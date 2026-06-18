import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>

export interface Genre {
  id: string
  name: string
  slug: string
  createdAt: string
}

type GenreRow = Database['public']['Tables']['genres']['Row']

function rowToGenre(row: GenreRow): Genre {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
  }
}

export async function listGenres(db: DbClient): Promise<Genre[]> {
  const { data, error } = await db.from('genres').select('*').order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToGenre)
}

export async function createGenre(db: DbClient, name: string): Promise<Genre> {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const { data, error } = await db.from('genres').insert({ name: name.trim(), slug }).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createGenre')
  return rowToGenre(data)
}

export async function deleteGenre(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('genres').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
