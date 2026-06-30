/**
 * CI guard for dashboard scroll contract.
 *
 * Rules:
 * 1. Admin/portal layouts must use ScrollableAppShell.
 * 2. No min-h-screen on dashboard content pages (auth/loading gates exempt).
 * 3. List managers must not nest a root overflow-y-auto scroll pane.
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

// --- Manager root nested vertical scroll ---
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
      `${rel(file)}: root wrapper must not be overflow-y-auto — ScrollableAppShell owns vertical scroll`,
    )
  }
}

if (errors.length > 0) {
  console.error('Scroll contract violations:\n')
  for (const err of errors) console.error(`  • ${err}`)
  process.exit(1)
}

console.log('Scroll contract OK')