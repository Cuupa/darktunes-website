'use client'

import { useTranslations } from 'next-intl'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical, EyeSlash, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useFanPageEditorStore } from '@/lib/fan-page/editor/FanPageEditorProvider'
import type { FanPageSection } from '@/lib/fan-page/schema/documentV1'
import { portalKey } from '@/i18n/portalKey'
import { cn } from '@/lib/utils'

const BLOCK_LABEL_KEYS: Record<FanPageSection['type'], string> = {
  hero: 'fanPage_block_hero',
  bio: 'fanPage_block_bio',
  release_grid: 'fanPage_block_releases',
  music_player: 'fanPage_block_music',
  tour_dates: 'fanPage_block_tour',
  smart_links: 'fanPage_block_links',
  newsletter_signup: 'fanPage_block_newsletter',
  gallery: 'fanPage_block_gallery',
  video_grid: 'fanPage_block_videos',
  merch_shelf: 'fanPage_block_merch',
  cta_banner: 'fanPage_block_cta',
  spacer: 'fanPage_block_spacer',
}

function SortableSectionRow({ section }: { section: FanPageSection }) {
  const t = useTranslations('portal')
  const selectedSectionId = useFanPageEditorStore((s) => s.selectedSectionId)
  const selectSection = useFanPageEditorStore((s) => s.selectSection)
  const removeSection = useFanPageEditorStore((s) => s.removeSection)
  const previewDevice = useFanPageEditorStore((s) => s.previewDevice)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const hidden = section.hiddenOn?.includes(previewDevice)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border border-border bg-background px-2 py-2',
        selectedSectionId === section.id && 'border-primary bg-primary/5',
        isDragging && 'opacity-60 shadow-md',
        hidden && 'opacity-50',
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label={t('fanPage_drag_handle')}
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={18} aria-hidden />
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 text-left text-sm font-medium"
        onClick={() => selectSection(section.id)}
      >
        <span className="capitalize">{t(portalKey(BLOCK_LABEL_KEYS[section.type]))}</span>
        {hidden ? (
          <EyeSlash size={14} className="ml-2 inline text-muted-foreground" aria-hidden />
        ) : null}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={t('fanPage_delete_section')}
        onClick={() => removeSection(section.id)}
      >
        <Trash size={16} aria-hidden />
      </Button>
    </div>
  )
}

export function FanPageCanvas() {
  const t = useTranslations('portal')
  const sections = useFanPageEditorStore((s) =>
    [...s.document.sections].sort((a, b) => a.order - b.order),
  )
  const reorderSection = useFanPageEditorStore((s) => s.reorderSection)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderSection(String(active.id), String(over.id))
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t('fanPage_sections_title')}</h2>
      </div>
      <div className="space-y-2 p-3" data-lenis-prevent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map((section) => (
              <SortableSectionRow key={section.id} section={section} />
            ))}
          </SortableContext>
        </DndContext>
        {sections.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">{t('fanPage_no_sections')}</p>
        ) : null}
      </div>
    </div>
  )
}