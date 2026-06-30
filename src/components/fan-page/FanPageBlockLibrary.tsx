'use client'

import { useTranslations } from 'next-intl'
import {
  Image as ImageIcon,
  Article,
  Disc,
  MusicNotes,
  Calendar,
  LinkSimple,
  Envelope,
  Images,
  Play,
  ShoppingBag,
  Megaphone,
  ArrowsVertical,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useFanPageEditorStore } from '@/lib/fan-page/editor/FanPageEditorProvider'
import type { FanPageBlockType } from '@/lib/fan-page/schema/documentV1'
import { portalKey } from '@/i18n/portalKey'

const BLOCKS: { type: FanPageBlockType; labelKey: string; icon: React.ElementType }[] = [
  { type: 'hero', labelKey: 'fanPage_block_hero', icon: ImageIcon },
  { type: 'bio', labelKey: 'fanPage_block_bio', icon: Article },
  { type: 'release_grid', labelKey: 'fanPage_block_releases', icon: Disc },
  { type: 'music_player', labelKey: 'fanPage_block_music', icon: MusicNotes },
  { type: 'tour_dates', labelKey: 'fanPage_block_tour', icon: Calendar },
  { type: 'smart_links', labelKey: 'fanPage_block_links', icon: LinkSimple },
  { type: 'newsletter_signup', labelKey: 'fanPage_block_newsletter', icon: Envelope },
  { type: 'gallery', labelKey: 'fanPage_block_gallery', icon: Images },
  { type: 'video_grid', labelKey: 'fanPage_block_videos', icon: Play },
  { type: 'merch_shelf', labelKey: 'fanPage_block_merch', icon: ShoppingBag },
  { type: 'cta_banner', labelKey: 'fanPage_block_cta', icon: Megaphone },
  { type: 'spacer', labelKey: 'fanPage_block_spacer', icon: ArrowsVertical },
]

export function FanPageBlockLibrary() {
  const t = useTranslations('portal')
  const addSection = useFanPageEditorStore((s) => s.addSection)
  const selectedSectionId = useFanPageEditorStore((s) => s.selectedSectionId)

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t('fanPage_blocks_title')}</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3" data-lenis-prevent>
        {BLOCKS.map(({ type, labelKey, icon: Icon }) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-[44px] flex-col gap-1 px-2 py-2 text-xs"
            onClick={() => addSection(type, selectedSectionId ?? undefined)}
          >
            <Icon size={18} aria-hidden />
            {t(portalKey(labelKey))}
          </Button>
        ))}
      </div>
    </div>
  )
}