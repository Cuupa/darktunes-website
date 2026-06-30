'use client'

import { NewsletterSection } from '@/components/NewsletterSection'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import type { FanPageTheme } from '@/lib/fan-page/schema/documentV1'

interface NewsletterBlockProps {
  theme: FanPageTheme
  heading?: string
  description?: string
}

export function NewsletterBlock({ theme, heading, description }: NewsletterBlockProps) {
  const colors = resolveThemeColors(theme)

  return (
    <div style={{ color: colors.text }}>
      <NewsletterSection heading={heading} description={description} />
    </div>
  )
}