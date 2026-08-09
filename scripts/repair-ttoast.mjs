/**
 * Repair tToast:
 * - Strip all `const tToast = useTranslations(...)` lines
 * - Inject once at the start of each PascalCase component function that uses tToast(
 * - Never inject into nested handlers (handleX, onX, lowercase names)
 */
import fs from 'node:fs'
import path from 'node:path'

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

function isPortalFile(file) {
  return (
    file.includes(`${path.sep}portal${path.sep}`) ||
    file.includes(`components${path.sep}portal${path.sep}`)
  )
}

function findComponents(src) {
  /** @type {{ name: string, openBrace: number, bodyStart: number, bodyEnd: number }[]} */
  const out = []
  // Only PascalCase names = React components
  const re =
    /(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{|const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{|const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?function\s*\([^)]*\)\s*\{|export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{/g
  let m
  while ((m = re.exec(src))) {
    const name = m[1] || m[2] || m[3] || m[4] || 'Component'
    const openBrace = m.index + m[0].length - 1
    let depth = 0
    for (let i = openBrace; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        depth--
        if (depth === 0) {
          out.push({
            name,
            openBrace,
            bodyStart: openBrace + 1,
            bodyEnd: i,
          })
          break
        }
      }
    }
  }
  return out
}

let fixed = 0
for (const file of files) {
  let src = fs.readFileSync(file, 'utf8')
  if (!src.includes('tToast(') && !src.includes('useTranslations(\'admin.toast\')') && !src.includes('useTranslations("admin.toast")') && !src.includes("useTranslations('portal')")) {
    // still clean orphaned tToast decls that reference admin.toast without calls? skip
  }
  if (!src.includes('tToast')) continue

  const ns = isPortalFile(file) ? 'portal' : 'admin.toast'

  if (isPortalFile(file)) {
    src = src.replace(/tToast\(\s*'([a-z0-9_]+)'\s*\)/g, (full, key) =>
      key.startsWith('toast_') ? full : `tToast('toast_${key}')`,
    )
  } else {
    src = src.replace(/tToast\(\s*'toast_([a-z0-9_]+)'\s*\)/g, `tToast('$1')`)
  }

  // Remove ALL tToast declarations (including illegal nested ones)
  src = src.replace(/^[ \t]*const tToast = useTranslations\([^)]*\)\s*\n/gm, '')

  if (!/from ['"]next-intl['"]/.test(src)) {
    if (src.startsWith("'use client'") || src.startsWith('"use client"')) {
      src = src.replace(
        /(['"]use client['"]\s*\n)/,
        `$1import { useTranslations } from 'next-intl'\n`,
      )
    } else {
      src = `import { useTranslations } from 'next-intl'\n` + src
    }
  } else if (!src.includes('useTranslations')) {
    src = src.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]next-intl['"]/,
      (_m, inner) =>
        `import { ${inner.trim()}${inner.trim() ? ', ' : ''}useTranslations } from 'next-intl'`,
    )
  }

  const components = findComponents(src)
  const injects = []
  for (const c of components) {
    const body = src.slice(c.bodyStart, c.bodyEnd)
    if (!body.includes('tToast(')) continue
    injects.push(c.bodyStart)
  }

  injects.sort((a, b) => b - a)
  for (const at of injects) {
    // Detect indent from first non-empty line in body
    const after = src.slice(at)
    const indentMatch = after.match(/^\n?([ \t]*)/)
    const indent = indentMatch?.[1] || '  '
    const injection = `\n${indent}const tToast = useTranslations('${ns}')\n`
    src = src.slice(0, at) + injection + src.slice(at)
  }

  // Detect remaining illegal: tToast call outside any component inject
  if (src.includes('tToast(') && !src.includes('const tToast = useTranslations')) {
    console.warn('MISSING component inject:', file)
  }

  // Detect tToast inside nested non-component (heuristic: after inject, search for
  // const tToast appearing more than once per file incorrectly in handlers - already stripped)

  fs.writeFileSync(file, src)
  fixed++
  console.log('repaired', path.relative(process.cwd(), file).replace(/\\/g, '/'), 'components', injects.length)
}

console.log('files', fixed)
