import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { globSync } from 'glob'

// #1db954 is Spotify's official brand color — required for Spotify logo icons
const ALLOWED_COLORS = new Set(['#493687', '#7e1e37', '#101010', '#292929', '#383838', '#ffffff', '#1db954'])

type Violation = {
  file: string
  line: number
  color: string
}

function findViolations(): Violation[] {
  const files = globSync('src/components/**/*.tsx', {
    cwd: process.cwd(),
    absolute: true,
  })

  const violations: Violation[] = []

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split(/\r?\n/)

    lines.forEach((line, index) => {
      const matches = [...line.matchAll(/#[0-9a-fA-F]{6}/g)]
      for (const match of matches) {
        const color = match[0].toLowerCase()
        if (!ALLOWED_COLORS.has(color)) {
          violations.push({
            file: path.relative(process.cwd(), filePath),
            line: index + 1,
            color,
          })
        }
      }
    })
  }

  return violations
}

describe('Corporate Identity colors', () => {
  it('allows only approved CI hex colors in src/components/**/*.tsx', () => {
    const violations = findViolations()
    const report = violations
      .map((violation) => `${violation.file}:${violation.line} → ${violation.color}`)
      .join('\n')

    expect(violations, report || 'No CI color violations found').toEqual([])
  })
})
