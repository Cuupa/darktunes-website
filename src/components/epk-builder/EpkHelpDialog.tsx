'use client'

import { useTranslations } from 'next-intl'
import { Question } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function EpkHelpDialog() {
  const t = useTranslations('portal')

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] min-w-[44px]"
              aria-label={t('epk_help_title')}
            >
              <Question size={18} aria-hidden="true" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('epk_help_title')}</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('epk_help_title')}</DialogTitle>
          <DialogDescription>{t('epk_help_description')}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>{t('epk_help_tip_select')}</li>
          <li>{t('epk_help_tip_context')}</li>
          <li>{t('epk_help_tip_fonts')}</li>
          <li>{t('epk_help_tip_templates')}</li>
          <li>{t('epk_help_tip_shortcuts')}</li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}