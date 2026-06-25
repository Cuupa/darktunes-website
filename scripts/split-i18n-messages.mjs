import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const LOCALES = ['en', 'de']

for (const locale of LOCALES) {
  const outDir = path.join(ROOT, 'src/i18n/messages', locale)
  const namespaces = fs
    .readdirSync(outDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/, ''))
    .sort()

  const indexImports = namespaces
    .map((namespace) => `import ${namespace} from './${namespace}.json'`)
    .join('\n')
  const indexExports = `export default {\n${namespaces.map((n) => `  ${n},`).join('\n')}\n} as const\n`
  fs.writeFileSync(path.join(outDir, 'index.ts'), `${indexImports}\n\n${indexExports}`)
}

console.log(`Regenerated index.ts for ${LOCALES.length} locale message bundles`)