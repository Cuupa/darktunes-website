/**
 * Sanitize admin-authored theme custom CSS before injection into <style>.
 * Blocks HTML/script breakout while keeping ordinary CSS rules usable.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/** Patterns that can break out of a <style> context or execute script. */
const DANGEROUS_PATTERNS: RegExp[] = [
  /<\/\s*style/i,
  /<\s*script/i,
  /javascript\s*:/i,
  /expression\s*\(/i,
  /@import\b/i,
  /behavior\s*:/i,
  /-moz-binding\s*:/i,
]

/**
 * Returns sanitized CSS safe for injection into a <style> element.
 * Returns empty string when content is empty or clearly malicious.
 */
export function sanitizeThemeCss(input: string | null | undefined): string {
  if (!input) return ''
  let css = input.replace(CONTROL_CHARS, '')

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(css)) {
      return ''
    }
  }

  // Strip any residual HTML tags that could still break context.
  css = css.replace(/<\/?[a-zA-Z][^>]*>/g, '')

  return css.trim()
}
