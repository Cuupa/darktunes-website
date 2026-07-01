/**
 * CI guard for dashboard scroll contract.
 *
 * Rules:
 * 1. Admin/portal layouts must use ScrollableAppShell.
 * 2. No min-h-screen on dashboard content pages (auth/loading gates exempt).
 * 3. List managers must use AdminListShell (not ad-hoc root overflow-y-auto).
 * 4. Standard list pages must use AdminPageShell layout="list".
 * 5. Horizontal table wrappers must not use overscroll-contain without a vertical owner
 *    (use horizontalScrollClass: overflow-x-auto overflow-y-clip overscroll-x-contain).
 */

import fs from 'fs'
import path from 'path'

const root = process.cwd()
const errors = []

function walk(dir) {
  const results = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...walk(full))
    else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) results.push(full)
  }
  return results
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/')
}

function isFullscreenGateLine(line) {
  return (
    line.includes('min-h-screen') &&
    line.includes('items-center') &&
    line.includes('justify-center')
  )
}

/** Blocks vertical wheel chaining when the wrapper has no vertical overflow. */
function isHorizontalScrollAntiPattern(line) {
  if (!line.includes('overflow-x-auto') || !line.includes('overscroll-contain')) return false
  if (line.includes('overflow-y-auto') || line.includes('overflow-auto')) return false
  if (
    line.includes('overflow-y-clip') ||
    line.includes('horizontalScrollClass') ||
    line.includes('overscroll-x-contain')
  ) {
    return false
  }
  return true
}

// --- Layout contract ---
const adminLayout = path.join(root, 'app/admin/_components/AdminClientLayout.tsx')
const portalLayout = path.join(root, 'app/portal/layout.tsx')

for (const file of [adminLayout, portalLayout]) {
  const content = fs.readFileSync(file, 'utf8')
  if (!content.includes('ScrollableAppShell')) {
    errors.push(`${rel(file)}: must use ScrollableAppShell`)
  }
}

// --- min-h-screen on dashboard routes ---
const dashboardDirs = [
  path.join(root, 'app/admin'),
  path.join(root, 'app/portal'),
]

for (const dir of dashboardDirs) {
  for (const file of walk(dir)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (!line.includes('min-h-screen')) return
      if (isFullscreenGateLine(line)) return
      errors.push(
        `${rel(file)}:${index + 1}: min-h-screen breaks ScrollableAppShell height contract (use w-full or a centered gate layout)`,
      )
    })
  }
}

// --- List managers must use AdminListShell ---
const listManagers = [
  'ArtistsManager.tsx',
  'ReleasesManager.tsx',
  'NewsManager.tsx',
  'SubmissionFormManager.tsx',
]

for (const name of listManagers) {
  const file = path.join(root, 'src/components/admin', name)
  const content = fs.readFileSync(file, 'utf8')
  if (!content.includes('AdminListShell')) {
    errors.push(`${rel(file)}: must use AdminListShell for viewport list layout`)
  }
}

const managersDir = path.join(root, 'src/components/admin')
const nestedScrollPattern =
  /className="[^"]*flex[^"]*flex-1[^"]*min-h-0[^"]*overflow-y-auto/

for (const file of walk(managersDir)) {
  if (!file.endsWith('Manager.tsx')) continue
  const content = fs.readFileSync(file, 'utf8')
  const returnMatch = content.match(/return\s*\(\s*<div[^>]*>/s)
  if (!returnMatch) continue
  if (nestedScrollPattern.test(returnMatch[0])) {
    errors.push(
      `${rel(file)}: root wrapper must not be overflow-y-auto — use AdminListShell instead`,
    )
  }
}

// --- List pages need viewport height chain ---
const listPages = [
  'app/admin/artists/page.tsx',
  'app/admin/releases/page.tsx',
  'app/admin/news/page.tsx',
  'app/admin/submission-form/page.tsx',
]

for (const page of listPages) {
  const file = path.join(root, page)
  const content = fs.readFileSync(file, 'utf8')
  if (!/layout=["']list["']/.test(content)) {
    errors.push(`${page}: AdminPageShell must set layout="list"`)
  }
}

// --- Horizontal-only scroll wrappers must not block wheel chaining ---
const horizontalScrollScanDirs = [
  path.join(root, 'src/components/admin'),
  path.join(root, 'src/components/ui'),
]

for (const dir of horizontalScrollScanDirs) {
  for (const file of walk(dir)) {
    if (!file.endsWith('.tsx')) continue
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (!isHorizontalScrollAntiPattern(line)) return
      errors.push(
        `${rel(file)}:${index + 1}: horizontal scroll wrapper must use horizontalScrollClass (overflow-y-clip + overscroll-x-contain), not overscroll-contain alone`,
      )
    })
  }
}

if (errors.length > 0) {
  console.error('Scroll contract violations:\n')
  for (const err of errors) console.error(`  • ${err}`)
  process.exit(1)
}

console.log('Scroll contract OK')