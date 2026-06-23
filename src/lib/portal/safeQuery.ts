/**
 * Wraps a Supabase head-only count query and returns 0 on any error.
 */
export async function safeHeadCount(
  promise: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count, error } = await promise
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}