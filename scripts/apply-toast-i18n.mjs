/**
 * Replaces toast.*( 'literal' ) with tToast('key') and injects useTranslations.
 * Portal files → portal.toast; admin/login → admin.toast.
 */
import fs from 'node:fs'
import path from 'node:path'

const map = JSON.parse(fs.readFileSync('scripts/i18n-toast-map.json', 'utf8'))
const enByLiteral = map
const literalToKey = Object.fromEntries(
  Object.entries(map).map(([lit, v]) => [lit, v.key]),
)

function walk(d, a = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(e.name)) continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, a)
    else if (/\.tsx$/.test(e.name)) a.push(p)
  }
  return a
}

const files = [
  ...walk('app/portal'),
  ...walk('app/admin'),
  ...walk('src/components/admin'),
  ...walk('src/components/portal'),
  ...walk('app/login'),
]

const toastRe =
  /toast\.(success|error|info|warning)\(\s*(['"])([^'"\\]+)\2\s*\)/g
const confirmRe = /window\.confirm\(\s*(['"])([^'"\\]+)\1\s*\)/g

let filesChanged = 0
let replacements = 0

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8')
  if (!src.includes('toast.') && !src.includes('window.confirm')) continue

  const isPortal =
    file.includes(`${path.sep}portal${path.sep}`) ||
    file.includes(`components${path.sep}portal${path.sep}`)
  const ns = isPortal ? 'portal.toast' : 'admin.toast'
  let changed = false

  const replaceToast = (match, kind, q, lit) => {
    const key = literalToKey[lit]
    if (!key) return match
    replacements++
    changed = true
    return `toast.${kind}(tToast('${key}'))`
  }

  const replaceConfirm = (match, q, lit) => {
    const key = literalToKey[lit]
    if (!key) return match
    replacements++
    changed = true
    return `window.confirm(tToast('${key}'))`
  }

  src = src.replace(toastRe, replaceToast)
  src = src.replace(confirmRe, replaceConfirm)

  if (!changed) continue

  // Inject import + hook
  if (!src.includes("from 'next-intl'") && !src.includes('from "next-intl"')) {
    if (src.startsWith("'use client'") || src.startsWith('"use client"')) {
      src = src.replace(
        /('use client'|"use client")\s*\n/,
        `$1\n\nimport { useTranslations } from 'next-intl'\n`,
      )
    } else {
      src = `import { useTranslations } from 'next-intl'\n` + src
    }
  } else if (!src.includes('useTranslations')) {
    src = src.replace(
      /from 'next-intl'/,
      "from 'next-intl'\n// useTranslations injected for toast i18n",
    )
    // ensure useTranslations in import
    src = src.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]next-intl['"]/,
      (m, inner) => {
        if (inner.includes('useTranslations')) return m
        return `import {${inner.trim() ? inner.trim() + ', ' : ''}useTranslations} from 'next-intl'`
      },
    )
  } else {
    // ensure useTranslations is imported
    src = src.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]next-intl['"]/,
      (m, inner) => {
        if (inner.includes('useTranslations')) return m
        return `import { ${inner.trim()}, useTranslations } from 'next-intl'`
      },
    )
  }

  if (!src.includes('tToast')) {
    // inject const tToast after first function component start that has hooks
    // Prefer after existing useTranslations lines
    if (/const t\w*\s*=\s*useTranslations\(/.test(src)) {
      src = src.replace(
        /(const t\w*\s*=\s*useTranslations\([^)]*\)\s*\n)/,
        `$1  const tToast = useTranslations('${ns}')\n`,
      )
    } else if (/export function \w+\([^)]*\)\s*\{/.test(src)) {
      src = src.replace(
        /(export function \w+\([^)]*\)\s*\{\n)/,
        `$1  const tToast = useTranslations('${ns}')\n`,
      )
    } else if (/export default function \w+\([^)]*\)\s*\{/.test(src)) {
      src = src.replace(
        /(export default function \w+\([^)]*\)\s*\{\n)/,
        `$1  const tToast = useTranslations('${ns}')\n`,
      )
    } else {
      console.warn('could not inject tToast in', file)
    }
  }

  fs.writeFileSync(file, src)
  filesChanged++
  console.log('updated', file.replace(/\\/g, '/'))
}

// Write toast namespaces into message files
function injectToastNs(filePath, locale) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const toast = {}
  for (const [lit, { key, de }] of Object.entries(enByLiteral)) {
    toast[key] = locale === 'de' ? de : lit
  }
  raw.toast = toast
  fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n')
}

injectToastNs('src/i18n/messages/en/admin.json', 'en')
injectToastNs('src/i18n/messages/de/admin.json', 'de')
injectToastNs('src/i18n/messages/en/portal.json', 'en')
injectToastNs('src/i18n/messages/de/portal.json', 'de')

console.log(`\nfiles_changed ${filesChanged} replacements ${replacements}`)
