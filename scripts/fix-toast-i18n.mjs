/**
 * 1) Flatten portal.toast → portal.toast_* keys (keeps PortalDictionary flat)
 * 2) Ensure every file using tToast has: const tToast = useTranslations('admin.toast'|'portal')
 * 3) Portal: tToast uses flat keys toast_* via useTranslations('portal')
 * 4) Admin: useTranslations('admin.toast') keeps nested keys
 */
import fs from 'node:fs'
import path from 'node:path'
import map from './i18n-toast-map.json' with { type: 'json' }

function walk(d, a = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(e.name)) continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, a)
    else if (/\.tsx$/.test(e.name)) a.push(p)
  }
  return a
}

// --- Fix message JSON ---
function fixAdminJson(file, locale) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  const toast = {}
  for (const [lit, { key, de }] of Object.entries(map)) {
    toast[key] = locale === 'de' ? de : lit
  }
  raw.toast = toast
  fs.writeFileSync(file, JSON.stringify(raw, null, 2) + '\n')
}

function fixPortalJson(file, locale) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  // remove nested toast if present
  delete raw.toast
  for (const [lit, { key, de }] of Object.entries(map)) {
    raw[`toast_${key}`] = locale === 'de' ? de : lit
  }
  fs.writeFileSync(file, JSON.stringify(raw, null, 2) + '\n')
}

fixAdminJson('src/i18n/messages/en/admin.json', 'en')
fixAdminJson('src/i18n/messages/de/admin.json', 'de')
fixPortalJson('src/i18n/messages/en/portal.json', 'en')
fixPortalJson('src/i18n/messages/de/portal.json', 'de')

// --- Fix TSX files ---
const files = [
  ...walk('app/portal'),
  ...walk('app/admin'),
  ...walk('src/components/admin'),
  ...walk('src/components/portal'),
  ...walk('app/login'),
]

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8')
  if (!src.includes('tToast(')) continue

  const isPortal =
    file.includes(`${path.sep}portal${path.sep}`) ||
    file.includes(`components${path.sep}portal${path.sep}`)

  // Portal: tToast('key') → tToast('toast_key') if not already prefixed
  if (isPortal) {
    src = src.replace(/tToast\(\s*'([a-z0-9_]+)'\s*\)/g, (m, key) => {
      if (key.startsWith('toast_')) return m
      return `tToast('toast_${key}')`
    })
  }

  // Ensure useTranslations import
  if (!/from ['"]next-intl['"]/.test(src)) {
    if (/^['"]use client['"]/.test(src.trimStart()) || src.startsWith("'use client'") || src.startsWith('"use client"')) {
      src = src.replace(/(['"]use client['"]\s*;?\s*\n)/, `$1import { useTranslations } from 'next-intl'\n`)
    } else {
      src = `import { useTranslations } from 'next-intl'\n` + src
    }
  } else if (!src.includes('useTranslations')) {
    src = src.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]next-intl['"]/,
      (m, inner) => `import { ${inner.trim()}${inner.trim() ? ', ' : ''}useTranslations } from 'next-intl'`,
    )
  }

  // Remove broken/duplicate tToast declarations
  src = src.replace(/^\s*const tToast = useTranslations\([^)]*\)\s*\n/gm, '')

  const ns = isPortal ? 'portal' : 'admin.toast'
  const inject = `  const tToast = useTranslations('${ns}')\n`

  // Inject into every function component that references tToast
  // Strategy: for each `function Name(...) {` or `export function` that has tToast in body
  const fnRe =
    /((?:export\s+)?(?:default\s+)?function\s+\w+\s*\([^)]*\)\s*\{|(?:export\s+)?const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{)/g

  let out = ''
  let last = 0
  let match
  const body = src
  // simpler: find all function starts and inject if tToast used before next function at same level — hard.
  // Simpler approach: inject right after "use client" block's first component that uses hooks:
  // Put at start of every function containing tToast(

  const parts = []
  let idx = 0
  const starts = []
  while ((match = fnRe.exec(src))) {
    starts.push({ index: match.index, end: match.index + match[0].length, header: match[0] })
  }
  starts.push({ index: src.length, end: src.length, header: '' })

  for (let i = 0; i < starts.length - 1; i++) {
    const start = starts[i]
    const next = starts[i + 1]
    const slice = src.slice(start.index, next.index)
    if (slice.includes('tToast(') && !slice.includes("const tToast = useTranslations")) {
      // inject after opening brace of this function
      const braceAt = start.end - 1 // last char of match is {
      // rebuild: before + inject after header
      const header = src.slice(start.index, start.end)
      const rest = src.slice(start.end, next.index)
      // skip if already injected in rest somehow
      if (!rest.includes(`const tToast = useTranslations('${ns}')`)) {
        parts.push(header + '\n' + inject + rest)
      } else {
        parts.push(src.slice(start.index, next.index))
      }
    } else {
      parts.push(src.slice(start.index, next.index))
    }
  }

  if (starts[0].index > 0) {
    src = src.slice(0, starts[0].index) + parts.join('')
  } else {
    src = parts.join('')
  }

  // Fallback: if still missing tToast declaration
  if (src.includes('tToast(') && !src.includes('const tToast = useTranslations')) {
    const m = src.match(/(export default function \w+\([^)]*\) \{\n|export function \w+\([^)]*\) \{\n)/)
    if (m) {
      src = src.replace(m[0], m[0] + inject)
    }
  }

  fs.writeFileSync(file, src)
  console.log('fixed', file.replace(/\\/g, '/'))
}

console.log('done')
