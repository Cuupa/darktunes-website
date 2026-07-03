/**
 * CI guard for dashboard scroll contract.
 *
 * Rules:
 * 1. Admin/portal layouts must use ScrollableAppShell.
 * 2. No min-h-screen on dashboard content pages (auth/loading gates exempt).
 *    Scans: app/admin/, app/portal/, app/press/dashboard/, app/editor/
 * 3. *Manager.tsx in src/components/admin/ and src/components/portal/ must use
 *    AdminListShell OR ScrollPanel if they contain overflow-y-auto and are not
 *    already fully guarded with data-lenis-prevent.
 * 4. Admin list pages that use AdminListShell must also set AdminPageShell layout="list".
 *    Dynamically scans app/admin/*\/page.tsx.
 * 5. Horizontal table wrappers must not use overscroll-contain without a vertical owner
 *    (use horizontalScrollClass: overflow-x-auto overflow-y-clip overscroll-x-contain).
 *    Scans: src/components/admin/, src/components/ui/, src/components/portal/,
 *           app/admin/, app/portal/
 * 6. Public components with overflow-y-auto must have data-lenis-prevent somewhere in
 *    the file. Scans src/components/ excluding admin/, portal/, layout/, ui/,
 *    animations/, notifications/.
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

// --- Rule 1: Layout contract ---
const adminLayout = path.join(root, 'app/admin/_components/AdminClientLayout.tsx')
const portalLayout = path.join(root, 'app/portal/layout.tsx')

for (const file of [adminLayout, portalLayout]) {
  const content = fs.readFileSync(file, 'utf8')
  if (!content.includes('ScrollableAppShell')) {
    errors.push(`${rel(file)}: must use ScrollableAppShell`)
  }
}

// --- Rule 2: No min-h-screen on dashboard routes ---
const dashboardDirs = [
  path.join(root, 'app/admin'),
  path.join(root, 'app/portal'),
  path.join(root, 'app/press/dashboard'),
  path.join(root, 'app/editor'),
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

// --- Rule 3: Manager files must use AdminListShell or ScrollPanel ---
// Enforce only on managers that actually scroll (have overflow-y-auto) and are not
// already fully guarded with data-lenis-prevent on all scrollable elements.
const managerScanDirs = [
  path.join(root, 'src/components/admin'),
  path.join(root, 'src/components/portal'),
]

for (const dir of managerScanDirs) {
  for (const file of walk(dir)) {
    if (!file.endsWith('Manager.tsx')) continue
    const content = fs.readFileSync(file, 'utf8')
    if (!content.includes('overflow-y-auto')) continue
    if (content.includes('AdminListShell') || content.includes('ScrollPanel')) continue
    // Skip files where all scrolling is already guarded with data-lenis-prevent
    if (content.includes('data-lenis-prevent')) continue
    errors.push(
      `${rel(file)}: manager with overflow-y-auto must use AdminListShell or ScrollPanel (or guard all scroll containers with data-lenis-prevent)`,
    )
  }
}

// --- Rule 4: Admin list pages that use AdminListShell must set layout="list" ---
// Dynamically scan all app/admin/*/page.tsx files.
const adminPagesDir = path.join(root, 'app/admin')
if (fs.existsSync(adminPagesDir)) {
  for (const entry of fs.readdirSync(adminPagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const pageFile = path.join(adminPagesDir, entry.name, 'page.tsx')
    if (!fs.existsSync(pageFile)) continue
    const content = fs.readFileSync(pageFile, 'utf8')
    if (!content.includes('AdminListShell')) continue
    if (/layout=["']list["']/.test(content)) continue
    errors.push(
      `${rel(pageFile)}: uses AdminListShell but AdminPageShell is missing layout="list"`,
    )
  }
}

// --- Rule 5: Horizontal-only scroll wrappers must not block wheel chaining ---
const horizontalScrollScanDirs = [
  path.join(root, 'src/components/admin'),
  path.join(root, 'src/components/ui'),
  path.join(root, 'src/components/portal'),
  path.join(root, 'app/admin'),
  path.join(root, 'app/portal'),
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

// --- Rule 6: Public components with overflow-y-auto must have data-lenis-prevent ---
// Scans src/components/ excluding dashboard-only subdirectories.
const publicComponentsRoot = path.join(root, 'src/components')
const publicComponentsExclude = new Set([
  'admin', 'portal', 'layout', 'ui', 'animations', 'notifications',
])

if (fs.existsSync(publicComponentsRoot)) {
  for (const entry of fs.readdirSync(publicComponentsRoot, { withFileTypes: true })) {
    if (publicComponentsExclude.has(entry.name)) continue
    const target = path.join(publicComponentsRoot, entry.name)
    const files = entry.isDirectory() ? walk(target) : [target]
    for (const file of files) {
      if (!file.endsWith('.tsx')) continue
      const content = fs.readFileSync(file, 'utf8')
      if (!content.includes('overflow-y-auto')) continue
      if (content.includes('data-lenis-prevent')) continue
      errors.push(
        `${rel(file)}: public component has overflow-y-auto without data-lenis-prevent (Lenis conflict risk)`,
      )
    }
  }
}

if (errors.length > 0) {
  console.error('Scroll contract violations:\n')
  for (const err of errors) console.error(`  • ${err}`)
  process.exit(1)
}

console.log('Scroll contract OK')