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

const toastRe = /toast\.(success|error|info|warning)\(\s*['"]([^'"\\]+)['"]/g
const confirmRe = /window\.confirm\(\s*['"]([^'"\\]+)['"]/g
const toastMap = new Map()
const confirmMap = new Map()

for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  let m
  while ((m = toastRe.exec(s))) {
    const t = m[2]
    if (!toastMap.has(t)) toastMap.set(t, [])
    toastMap.get(t).push(f.replace(/\\/g, '/'))
  }
  while ((m = confirmRe.exec(s))) {
    const t = m[1]
    if (!confirmMap.has(t)) confirmMap.set(t, [])
    confirmMap.get(t).push(f.replace(/\\/g, '/'))
  }
}

console.log('=== TOASTS', toastMap.size, '===')
;[...toastMap.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([t, fs]) => console.log(JSON.stringify(t), 'x' + fs.length, fs[0]))

console.log('\n=== CONFIRMS', confirmMap.size, '===')
;[...confirmMap.entries()].forEach(([t, fs]) =>
  console.log(JSON.stringify(t), 'x' + fs.length, fs[0]),
)
