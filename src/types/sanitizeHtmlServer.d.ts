declare module 'darktunes-sanitize-html-server' {
  export function createServerSanitizer(): {
    purify: import('dompurify').DOMPurify
    createElement: (tag: string) => {
      innerHTML: string
      querySelectorAll(selector: string): ArrayLike<{
        getAttribute(name: string): string | null
        remove(): void
      }>
    }
  }
}
