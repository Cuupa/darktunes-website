/** Minimal types for the jsdom surface sanitizeHtml.server.ts uses. */
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string)
    readonly window: {
      document: {
        createElement(tag: string): {
          innerHTML: string
          querySelectorAll(selector: string): ArrayLike<{
            getAttribute(name: string): string | null
            remove(): void
          }>
        }
      }
    }
  }
}
