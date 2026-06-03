import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BUILD_MANIFEST_PATH = path.join(ROOT, '.next', 'build-manifest.json')
const APP_BUILD_MANIFEST_PATH = path.join(ROOT, '.next', 'app-build-manifest.json')

/**
 * Budget thresholds (uncompressed bytes).
 *
 * Route budgets exclude the globally shared rootMainFiles so that only the
 * route-specific and route-level-shared JS is measured.  Shared bundle has
 * its own separate budget.
 *
 * Derived from actual CI build output (June 2026):
 *   rootMainFiles uncompressed  ≈ 348 KB  → budget 450 KB
 *   app/page route-specific     ≈ 423 KB  → budget 550 KB
 *   app/artists/[slug]/page     ≈ 274 KB  → budget 350 KB
 * Each budget gives ~20 % headroom above the measured baseline.
 */
const budgets = {
  'shared bundle (rootMainFiles)': 450 * 1024,
  'app/page route-specific JS': 550 * 1024,
  'app/artists/[slug]/page route-specific JS': 350 * 1024,
}

const buildManifest = JSON.parse(readFileSync(BUILD_MANIFEST_PATH, 'utf-8'))
const appBuildManifest = JSON.parse(readFileSync(APP_BUILD_MANIFEST_PATH, 'utf-8'))

const appPages = appBuildManifest.pages ?? {}

/** Normalise a file path by stripping any leading slash. */
const normalisePath = (/** @type {string} */ f) => (f.startsWith('/') ? f.slice(1) : f)

/** Absolute file size on disk (uncompressed). */
const fileSize = (/** @type {string} */ file) => {
  const fullPath = path.join(ROOT, '.next', normalisePath(file))
  return statSync(fullPath).size
}

/** Set of globally shared files from build-manifest rootMainFiles. */
const sharedFiles = new Set((buildManifest.rootMainFiles ?? []).map(normalisePath))

/** Total size of a route's JS files, excluding globally shared chunks. */
const routeSize = (/** @type {string} */ route) => {
  const files = appPages[`/${route}`] ?? appPages[route] ?? []
  return files
    .filter((f) => typeof f === 'string' && f.endsWith('.js') && !sharedFiles.has(normalisePath(f)))
    .reduce((total, file) => total + fileSize(file), 0)
}

/** Total uncompressed size of all rootMainFiles shared chunks. */
const sharedBundleSize = (buildManifest.rootMainFiles ?? [])
  .filter((f) => f.endsWith('.js'))
  .reduce((total, file) => total + fileSize(file), 0)

const checks = [
  ['shared bundle (rootMainFiles)', sharedBundleSize],
  ['app/page route-specific JS', routeSize('page')],
  ['app/artists/[slug]/page route-specific JS', routeSize('artists/[slug]/page')],
]

let failed = false

for (const [name, size] of checks) {
  const budget = budgets[name]
  if (!budget) continue

  if (size > budget) {
    console.error(
      `❌ ${name}: ${(size / 1024).toFixed(1)} KB exceeds budget of ${(budget / 1024).toFixed(1)} KB`,
    )
    failed = true
  } else {
    console.info(
      `✅ ${name}: ${(size / 1024).toFixed(1)} KB is within budget of ${(budget / 1024).toFixed(1)} KB`,
    )
  }
}

if (failed) {
  process.exit(1)
}
