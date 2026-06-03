import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BUILD_MANIFEST_PATH = path.join(ROOT, '.next', 'build-manifest.json')
const APP_BUILD_MANIFEST_PATH = path.join(ROOT, '.next', 'app-build-manifest.json')

const budgets = {
  'app/page': 150 * 1024,
  'app/artists/[slug]/page': 100 * 1024,
  'framer-motion chunk': 80 * 1024,
  'lenis chunk': 20 * 1024,
}

const buildManifest = JSON.parse(readFileSync(BUILD_MANIFEST_PATH, 'utf-8'))
const appBuildManifest = JSON.parse(readFileSync(APP_BUILD_MANIFEST_PATH, 'utf-8'))

const appPages = appBuildManifest.pages ?? {}
const allFiles = new Set(Object.values(appPages).flat())

const fileSize = (file) => {
  const normalized = file.startsWith('/') ? file.slice(1) : file
  const fullPath = path.join(ROOT, '.next', normalized)
  return statSync(fullPath).size
}

const routeSize = (route) => {
  const files = appPages[`/${route}`] ?? appPages[route] ?? []
  return files.reduce((total, file) => total + fileSize(file), 0)
}

const matchingChunkSize = (needle) => {
  const matches = Array.from(allFiles).filter(
    (file) => typeof file === 'string' && file.includes(needle) && file.endsWith('.js'),
  )
  return matches.reduce((total, file) => total + fileSize(file), 0)
}

const checks = [
  ['app/page', routeSize('page')],
  ['app/artists/[slug]/page', routeSize('artists/[slug]/page')],
  ['framer-motion chunk', matchingChunkSize('framer-motion')],
  ['lenis chunk', matchingChunkSize('lenis')],
]

let failed = false

for (const [name, size] of checks) {
  const budget = budgets[name]
  if (!budget) {
    continue
  }

  if (size > budget) {
    console.error(
      `❌ ${name}: ${(size / 1024).toFixed(1)} KB exceeds ${(budget / 1024).toFixed(1)} KB`,
    )
    failed = true
  } else {
    console.info(
      `✅ ${name}: ${(size / 1024).toFixed(1)} KB within ${(budget / 1024).toFixed(1)} KB`,
    )
  }
}

if (failed) {
  process.exit(1)
}

const sharedMainSize = (buildManifest.rootMainFiles ?? [])
  .filter((file) => file.endsWith('.js'))
  .reduce((total, file) => total + fileSize(file), 0)

console.info(`ℹ️ root main JS bundle: ${(sharedMainSize / 1024).toFixed(1)} KB`)
