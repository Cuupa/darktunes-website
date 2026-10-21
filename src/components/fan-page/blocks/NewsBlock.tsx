'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import type { FanPageTheme } from '@/lib/fan-page/schema/documentV1'
import type { FanPageNewsItem } from '@/lib/fan-page/mergeNews'
import { sanitizeHtml } from '@/lib/sanitizeHtml'

interface NewsBlockProps {
  items?: FanPageNewsItem[]
  limit?: number
  theme: FanPageTheme
  title?: string
}

export function NewsBlock({ items = [], limit = 6, theme, title }: NewsBlockProps) {
  const t = useTranslations('portal')
  const colors = resolveThemeColors(theme)
  const visible = items.slice(0, limit)
  const [openId, setOpenId] = useState<string | null>(null)
  const openItem = visible.find((item) => item.id === openId) ?? null

  if (visible.length === 0) {
    return <p className="text-sm opacity-60">—</p>
  }

  return (
    <div>
      {title ? (
        <h2 className="mb-6 text-2xl font-bold tracking-tight" style={{ color: colors.primary }}>
          {title}
        </h2>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => {
          const card = (
            <>
              {item.imageUrl ? (
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src={item.imageUrl}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                </div>
              ) : null}
              <div className="p-4">
                <p className="text-sm font-semibold" style={{ color: colors.text }}>
                  {item.title}
                </p>
                {item.excerpt ? (
                  <p className="mt-2 line-clamp-3 text-sm opacity-70" style={{ color: colors.text }}>
                    {item.excerpt}
                  </p>
                ) : null}
              </div>
            </>
          )
          return (
            <li key={item.id}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="block overflow-hidden rounded-lg border border-white/10 bg-black/20 transition hover:border-white/25"
                >
                  {card}
                </Link>
              ) : (
                <button
                  type="button"
                  className="block w-full overflow-hidden rounded-lg border border-white/10 bg-black/20 text-left transition hover:border-white/25"
                  onClick={() => setOpenId(item.id)}
                >
                  {card}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <Dialog open={!!openItem} onOpenChange={(open) => { if (!open) setOpenId(null) }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl">
          {openItem ? (
            <>
              <DialogHeader>
                <DialogTitle>{openItem.title}</DialogTitle>
                <DialogDescription className="sr-only">{t('fanPage_news_read_more')}</DialogDescription>
              </DialogHeader>
              <div
                className="overflow-y-auto overscroll-contain max-h-[70vh] prose prose-invert max-w-none text-sm"
                data-lenis-prevent
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(openItem.content) }}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
