/**
 * app/portal/profile/_components/epkPdf.ts
 *
 * WYSIWYG EPK export — uses the browser print dialog on the live HTML preview.
 */

import type { Dictionary } from '@/i18n/types'
import type { EpkPdfMessages } from '@/lib/epk/printEpkDocument'
import { generateEpkPdfFromPreview } from '@/lib/epk/printEpkDocument'
import type { EPKData } from './EPKPreview'

export function buildEpkPdfMessages(dict: Dictionary['portal']): EpkPdfMessages {
  return {
    popupBlocked: dict.profile_epk_error_popup_blocked,
    previewUnavailable: dict.profile_epk_error_preview_unavailable,
    printFailed: dict.profile_epk_error_print_failed,
  }
}

export async function generateEpkPdf(
  data: EPKData,
  messages: EpkPdfMessages,
  sourceRoot?: HTMLElement | null,
): Promise<void> {
  await generateEpkPdfFromPreview({
    artistName: data.artistName,
    orientation: data.epkOrientation,
    sourceRoot,
    messages,
  })
}