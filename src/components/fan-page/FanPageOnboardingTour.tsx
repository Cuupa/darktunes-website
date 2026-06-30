'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'fan-page-onboarding-dismissed-v1'

const STEPS = [
  'fanPage_onboarding_step1',
  'fanPage_onboarding_step2',
  'fanPage_onboarding_step3',
  'fanPage_onboarding_step4',
  'fanPage_onboarding_step5',
] as const

export function FanPageOnboardingTour() {
  const t = useTranslations('portal')
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setOpen(localStorage.getItem(STORAGE_KEY) !== '1')
      } catch {
        setOpen(true)
      }
      setMounted(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore quota errors
    }
    setOpen(false)
  }

  const handleNext = () => {
    if (step >= STEPS.length - 1) {
      dismiss()
      return
    }
    setStep((prev) => prev + 1)
  }

  const handleBack = () => {
    setStep((prev) => Math.max(0, prev - 1))
  }

  if (!mounted || !open) return null

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('fanPage_onboarding_title')}</DialogTitle>
          <DialogDescription>{t(STEPS[step])}</DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t('fanPage_onboarding_progress', { current: step + 1, total: STEPS.length })}
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
            {t('fanPage_onboarding_skip')}
          </Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={handleBack}>
                {t('fanPage_onboarding_back')}
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={handleNext}>
              {step >= STEPS.length - 1
                ? t('fanPage_onboarding_done')
                : t('fanPage_onboarding_next')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}