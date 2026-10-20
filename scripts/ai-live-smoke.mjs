/**
 * NVIDIA live smoke tests. Requires NVIDIA_API_KEY and AI_LIVE_TESTS=1.
 * Never run from CI on ordinary PRs.
 */
const enabled = process.env.AI_LIVE_TESTS === '1'
const key = process.env.NVIDIA_API_KEY?.trim()
if (!enabled || !key) {
  console.log('[test:ai:live] skipped — set NVIDIA_API_KEY and AI_LIVE_TESTS=1 to run.')
  process.exit(0)
}

const base = 'https://integrate.api.nvidia.com/v1/chat/completions'
const models = [
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'nvidia/nemotron-3-super-120b-a12b',
]

const results = []
for (const model of models) {
  const started = Date.now()
  const res = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Antworte mit dem einzelnen Wort pong.' }],
      max_tokens: 32,
      temperature: 1,
      top_p: 0.95,
      chat_template_kwargs: { enable_thinking: false },
    }),
  })
  const body = await res.text()
  results.push({ model, status: res.status, ms: Date.now() - started, ok: res.ok, preview: body.slice(0, 180) })
}

const failed = results.filter((row) => !row.ok)
console.log(JSON.stringify({ results }, null, 2))
if (failed.length > 0) {
  console.error('[test:ai:live] one or more models failed')
  process.exit(1)
}
console.log('[test:ai:live] both models responded')
