'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface ExcelExportFallbackDialogProps {
  open: boolean
  title: string
  /** Plain-language reason the complete (raw) workbook could not be built. */
  description: string
  retryLabel: string
  summaryOnlyLabel: string
  cancelLabel: string
  onRetry: () => void
  onSummaryOnly: () => void
  onCancel: () => void
}

/**
 * Shown when the complete Statement of Sales Excel (with original-report tabs)
 * could not be built. The operator decides explicitly: retry, download a
 * clearly named summary-only file, or cancel. No silent fallback.
 */
export function ExcelExportFallbackDialog({
  open,
  title,
  description,
  retryLabel,
  summaryOnlyLabel,
  cancelLabel,
  onRetry,
  onSummaryOnly,
  onCancel,
}: ExcelExportFallbackDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" className="min-h-11" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={onSummaryOnly}>
            {summaryOnlyLabel}
          </Button>
          <Button type="button" className="min-h-11" onClick={onRetry}>
            {retryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
