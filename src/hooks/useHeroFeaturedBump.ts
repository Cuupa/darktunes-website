'use client'

import { useState } from 'react'
import { useNews } from '@/hooks/useNews'
import { useReleases } from '@/hooks/useReleases'
import { previewFeaturedBump, type HeroFeaturedItem, type HeroFeaturedKind } from '@/lib/heroFeatured'
import { HERO_BUMP_UPDATE } from '@/lib/heroFeatured'

type PendingAction = {
  bumpTarget: HeroFeaturedItem
  message: string
  onConfirm: (bumpTarget: HeroFeaturedItem) => Promise<void>
}

export function useHeroFeaturedBump() {
  const { releases, updateRelease } = useReleases()
  const { news, updateNewsPost } = useNews()
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const bumpHeroItem = async (bumpTarget: HeroFeaturedItem) => {
    if (bumpTarget.kind === 'release') {
      await updateRelease(bumpTarget.id, HERO_BUMP_UPDATE)
      return
    }
    await updateNewsPost(bumpTarget.id, HERO_BUMP_UPDATE)
  }

  const runWithOptionalBump = async (options: {
    activatingFeatured: boolean
    wasFeatured: boolean
    itemId: string
    kind: HeroFeaturedKind
    action: (bumpTarget?: HeroFeaturedItem) => Promise<void>
  }) => {
    const enablingFeatured = options.activatingFeatured && !options.wasFeatured
    if (!enablingFeatured) {
      await options.action()
      return
    }

    const preview = previewFeaturedBump(releases, news, {
      id: options.itemId,
      kind: options.kind,
    })

    if (preview.needsConfirm && preview.bumpTarget) {
      setPendingAction({
        bumpTarget: preview.bumpTarget,
        message: preview.message,
        onConfirm: async (bumpTarget) => {
          await bumpHeroItem(bumpTarget)
          await options.action(bumpTarget)
        },
      })
      return
    }

    await options.action()
  }

  const confirmPendingAction = async () => {
    if (!pendingAction) return
    const action = pendingAction
    setPendingAction(null)
    await action.onConfirm(action.bumpTarget)
  }

  const cancelPendingAction = () => setPendingAction(null)

  return {
    pendingAction,
    runWithOptionalBump,
    confirmPendingAction,
    cancelPendingAction,
    bumpHeroItem,
  }
}