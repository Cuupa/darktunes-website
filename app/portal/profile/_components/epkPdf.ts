import type { useTranslations } from 'next-intl'
/**
 * app/portal/profile/_components/epkPdf.ts
 *
 * WYSIWYG EPK export — uses the browser print dialog on the live HTML preview.
 */

import type { EpkPdfMessages } from '@/lib/epk/printEpkDocument'
import { generateEpkPdfFromPreview } from '@/lib/epk/printEpkDocument'
import type { EPKData } from './EPKPreview'

export function buildEpkPdfMessages(t: ReturnType<typeof useTranslations<'portal'>>): EpkPdfMessages {
  return {
    popupBlocked: t('profile_epk_error_popup_blocked'),
    previewUnavailable: t('profile_epk_error_preview_unavailable'),
    printFailed: t('profile_epk_error_print_failed'),
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