/**
 * src/lib/epk/printEpkDocument.ts
 *
 * WYSIWYG EPK PDF export via the browser print dialog.
 * Clones the live HTML preview into a print window so the PDF matches
 * EPKPreview exactly (themes, layouts, rich text, icons).
 */

const EPK_ROOT_SELECTOR = '[data-epk-root]'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function collectStylesheetLinks(): string {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => {
      const href = (link as HTMLLinkElement).href
      return href ? `<link rel="stylesheet" href="${href}">` : ''
    })
    .join('\n')
}

function collectInlineStyles(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((style) => {
      const text = style.textContent ?? ''
      // Prevent `</style>` sequences inside CSS from breaking the print document.
      const safe = text.replace(/<\/style/gi, '<\\/style')
      return `<style>${safe}</style>`
    })
    .join('\n')
}

/** Returns true when the element is visible (not inside a hidden ancestor). */
function isElementVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false
  return el.getClientRects().length > 0
}

/**
 * Deep-clone the EPK root and normalise images for print:
 * copies resolved `currentSrc`, strips lazy-loading attributes.
 */
function cloneEpkRootForPrint(sourceRoot: HTMLElement): HTMLElement {
  const clone = sourceRoot.cloneNode(true) as HTMLElement

  const sourceImages = sourceRoot.querySelectorAll('img')
  const cloneImages = clone.querySelectorAll('img')
  sourceImages.forEach((img, index) => {
    const target = cloneImages[index]
    if (!target) return
    const resolved = img.currentSrc || img.src
    if (resolved) target.setAttribute('src', resolved)
    target.removeAttribute('loading')
    target.removeAttribute('srcset')
    target.removeAttribute('sizes')
  })

  return clone
}

async function waitForStylesheets(doc: Document): Promise<void> {
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
  await Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          const el = link as HTMLLinkElement
          if (el.sheet) {
            resolve()
            return
          }
          const timer = window.setTimeout(resolve, 8_000)
          const done = () => {
            window.clearTimeout(timer)
            resolve()
          }
          el.addEventListener('load', done, { once: true })
          el.addEventListener('error', done, { once: true })
        }),
    ),
  )

  try {
    await doc.fonts?.ready
  } catch {
    // fonts API unavailable — continue without blocking
  }
}

async function waitForDocumentReady(doc: Document): Promise<void> {
  if (doc.readyState === 'complete') return
  await new Promise<void>((resolve) => {
    doc.defaultView?.addEventListener('load', () => resolve(), { once: true })
  })
}

async function waitForImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images)
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          const timer = window.setTimeout(resolve, 8_000)
          const done = () => {
            window.clearTimeout(timer)
            resolve()
          }
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        }),
    ),
  )
}

export interface EpkPdfMessages {
  popupBlocked: string
  previewUnavailable: string
  printFailed: string
}

export interface PrintEpkDocumentOptions {
  sourceRoot: HTMLElement
  title: string
  orientation?: 'portrait' | 'landscape'
  messages: EpkPdfMessages
}

/**
 * Opens a print window with a clone of the EPK preview and triggers the
 * system print dialog (user saves as PDF).
 */
export async function printEpkDocument(options: PrintEpkDocumentOptions): Promise<void> {
  const { sourceRoot, title, orientation = 'portrait', messages } = options

  // Do not pass `noopener` — some browsers nullify or restrict the returned
  // Window reference, which breaks programmatic print() calls.
  const printWindow = window.open('', '_blank', 'width=920,height=1200')
  if (!printWindow) {
    throw new Error(messages.popupBlocked)
  }

  const clone = cloneEpkRootForPrint(sourceRoot)

  const pageRule =
    orientation === 'landscape'
      ? '@page { size: A4 landscape; margin: 0; }'
      : '@page { size: A4 portrait; margin: 0; }'

  const maxWidth = orientation === 'landscape' ? '297mm' : '210mm'

  const printCss = `
    ${pageRule}
    html, body {
      margin: 0;
      padding: 0;
      background: #101010;
    }
    body {
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    [data-epk-root] {
      width: 100% !important;
      max-width: ${maxWidth} !important;
      aspect-ratio: unset !important;
      min-height: auto !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  `

  printWindow.document.open()
  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  ${collectStylesheetLinks()}
  ${collectInlineStyles()}
  <style>${printCss}</style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`)
  printWindow.document.close()

  await waitForDocumentReady(printWindow.document)
  await waitForStylesheets(printWindow.document)
  await waitForImages(printWindow.document)

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(fallbackTimer)
      window.removeEventListener('afterprint', finish)
      printWindow.removeEventListener?.('afterprint', finish)
      try {
        printWindow.close()
      } catch {
        // Window may already be closed by the user
      }
      resolve()
    }

    const fallbackTimer = window.setTimeout(finish, 120_000)
    // Safari may fire afterprint on the opener; listen on both windows.
    printWindow.addEventListener('afterprint', finish, { once: true })
    window.addEventListener('afterprint', finish, { once: true })

    try {
      printWindow.focus()
      printWindow.print()
    } catch (err) {
      settled = true
      window.clearTimeout(fallbackTimer)
      window.removeEventListener('afterprint', finish)
      printWindow.removeEventListener?.('afterprint', finish)
      try {
        printWindow.close()
      } catch {
        // ignore
      }
      reject(err instanceof Error ? err : new Error(messages.printFailed))
    }
  })
}

/** Resolves the EPK document root element from the live preview DOM. */
export function findEpkDocumentRoot(preferred?: HTMLElement | null): HTMLElement | null {
  if (preferred?.isConnected) {
    // Prefer an explicit ref when visible; otherwise fall through so a visible
    // modal instance wins over a hidden force-mounted tab preview.
    if (isElementVisible(preferred)) return preferred
  }

  const roots = document.querySelectorAll<HTMLElement>(EPK_ROOT_SELECTOR)
  if (roots.length === 0) return preferred?.isConnected ? preferred : null

  // Prefer the visible instance (e.g. modal preview over a hidden tab panel).
  for (const root of roots) {
    if (isElementVisible(root)) return root
  }

  // Hidden force-mounted preview (portal EPK tab) — still valid for print.
  if (preferred?.isConnected) return preferred
  return roots[0] ?? null
}

export interface GenerateEpkPdfFromPreviewOptions {
  artistName: string
  orientation?: 'portrait' | 'landscape'
  sourceRoot?: HTMLElement | null
  messages: EpkPdfMessages
}

/**
 * Entry point for portal PDF download buttons.
 * Uses the rendered HTML preview — not a separate PDF engine.
 */
export async function generateEpkPdfFromPreview(
  options: GenerateEpkPdfFromPreviewOptions,
): Promise<void> {
  const root = findEpkDocumentRoot(options.sourceRoot)
  if (!root) {
    throw new Error(options.messages.previewUnavailable)
  }

  await printEpkDocument({
    sourceRoot: root,
    title: `${options.artistName} — Electronic Press Kit`,
    orientation: options.orientation,
    messages: options.messages,
  })
}