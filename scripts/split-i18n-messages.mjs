import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const LOCALES = ['en', 'de']

for (const locale of LOCALES) {
  const sourcePath = path.join(ROOT, 'src/i18n/dictionaries', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
  const outDir = path.join(ROOT, 'src/i18n/messages', locale)
  fs.mkdirSync(outDir, { recursive: true })

  const namespaces = Object.keys(data).sort()
  for (const namespace of namespaces) {
    const outPath = path.join(outDir, `${namespace}.json`)
    fs.writeFileSync(outPath, `${JSON.stringify(data[namespace], null, 2)}\n`)
  }

  const indexImports = namespaces
    .map((namespace) => `import ${namespace} from './${namespace}.json'`)
    .join('\n')
  const indexExports = `export default {\n${namespaces.map((n) => `  ${n},`).join('\n')}\n} as const\n`
  fs.writeFileSync(
    path.join(outDir, 'index.ts'),
    `${indexImports}\n\n${indexExports}`,
  )
}

console.log(`Split ${LOCALES.length} locale dictionaries into src/i18n/messages/*/`)