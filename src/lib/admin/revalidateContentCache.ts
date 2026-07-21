/**
 * Fire-and-forget public ISR revalidation from admin client hooks.
 */

export async function revalidateContentCache(
  accessToken: string,
  tags: string[],
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<void> {
  if (tags.length === 0) return
  try {
    await fetchImpl('/api/revalidate-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ tags }),
    })
  } catch {
    // Non-critical — public TTL still caps staleness
  }
}
