/**
 * Heuristic scan for hardcoded English UI strings in portal/admin TSX.
 * Prints toast/confirm/heading-like string literals.
 */
import fs from 'node:fs'
import path from 'node:path'

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', '.next'].includes(e.name)) continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.tsx$/.test(e.name)) acc.push(p)
  }
  return acc
}

const roots = [
  'app/portal',
  'app/admin',
  'src/components/admin',
  'src/components/portal',
  'app/login',
]

const patterns = [
  /toast\.(success|error|info|warning)\(\s*['"`]([^'"`]+)['"`]/g,
  /window\.confirm\(\s*['"`]([^'"`]+)['"`]/g,
  /alert\(\s*['"`]([^'"`]+)['"`]/g,
  /heading=\{?\s*['"`]([A-Za-z][^'"`]{3,})['"`]/g,
  /description=\{?\s*['"`]([A-Za-z][^'"`]{8,})['"`]/g,
  /placeholder=\{?\s*['"`]([A-Za-z][^'"`]{3,})['"`]/g,
  /aria-label=\{?\s*['"`]([A-Za-z][^'"`]{3,})['"`]/g,
  /title=\{?\s*['"`]([A-Za-z][^'"`]{3,})['"`]/g,
  />(Loading[….…]?|Failed to[^<]{0,40}|No [a-z][^<]{0,40}|Select [a-z][^<]{0,30}|Save|Cancel|Delete|Error)</g,
]

const files = roots.flatMap((r) => (fs.existsSync(r) ? walk(r) : []))
const hits = []

for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  // skip if mostly i18n already for toasts
  for (const re of patterns) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(s))) {
      const text = m[2] || m[1]
      if (!text) continue
      if (/^https?:/.test(text)) continue
      if (/^[a-z0-9_.-]+$/.test(text) && text.includes('_')) continue // likely key
      if (text.startsWith('t(') || text.includes('${')) continue
      if (text.length < 3) continue
      hits.push({ f: f.replace(/\\/g, '/'), text: text.slice(0, 120) })
    }
  }
}

const seen = new Set()
const uniq = hits.filter((h) => {
  const id = h.f + '|' + h.text
  if (seen.has(id)) return false
  seen.add(id)
  return true
})

// group by file
const byFile = new Map()
for (const h of uniq) {
  if (!byFile.has(h.f)) byFile.set(h.f, [])
  byFile.get(h.f).push(h.text)
}

const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)
console.log(`files_with_hits ${sorted.length} total_hits ${uniq.length}`)
for (const [f, texts] of sorted) {
  console.log(`\n## ${f} (${texts.length})`)
  for (const t of texts.slice(0, 25)) console.log(`  - ${JSON.stringify(t)}`)
  if (texts.length > 25) console.log(`  ... +${texts.length - 25} more`)
}
