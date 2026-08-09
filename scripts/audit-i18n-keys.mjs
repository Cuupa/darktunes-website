import fs from 'node:fs'
import path from 'node:path'

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(tsx|ts)$/.test(e.name)) acc.push(p)
  }
  return acc
}

function flat(o, p = '') {
  const r = {}
  for (const [k, v] of Object.entries(o)) {
    const kk = p ? `${p}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(r, flat(v, kk))
    else r[kk] = v
  }
  return r
}

const enP = JSON.parse(fs.readFileSync('src/i18n/messages/en/portal.json', 'utf8'))
const enA = flat(JSON.parse(fs.readFileSync('src/i18n/messages/en/admin.json', 'utf8')))

const files = [
  ...walk('app/portal'),
  ...walk('app/admin'),
  ...walk('src/components/admin'),
  ...walk('src/components/portal'),
]

const reNs = /useTranslations\(\s*['"](\w+)['"]\s*\)/g
const reT = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g
const rePortalKey = /portalKey\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g

const missing = []
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  const nsList = [...s.matchAll(reNs)].map((m) => m[1])
  if (!nsList.length) continue
  const primary = nsList[0]
  const dict = primary === 'admin' ? enA : primary === 'portal' ? enP : null
  if (!dict) continue
  const keys = new Set()
  for (const m of s.matchAll(reT)) keys.add(m[1])
  for (const m of s.matchAll(rePortalKey)) keys.add(m[1])
  for (const k of keys) {
    if (k.includes('.')) {
      if (primary === 'portal' && k.startsWith('portal.')) {
        missing.push({ f, k, ns: primary, reason: 'double-namespace' })
      }
      continue
    }
    if (!(k in dict)) missing.push({ f, k, ns: primary, reason: 'missing-key' })
  }
}

const seen = new Set()
const uniq = missing.filter((m) => {
  const id = `${m.f}|${m.k}`
  if (seen.has(id)) return false
  seen.add(id)
  return true
})

console.log(`issues ${uniq.length}`)
for (const m of uniq.slice(0, 100)) {
  console.log(`${m.reason}\t${m.ns}\t${m.k}\t${m.f.replace(/\\/g, '/')}`)
}
