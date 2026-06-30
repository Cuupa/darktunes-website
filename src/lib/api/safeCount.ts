export async function safeCount(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  try {
    const { count, error } = await query
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}