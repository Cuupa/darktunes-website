'use client'

import { useEffect, useState } from 'react'
import type { LandingPageDocumentV1 } from '@/lib/fan-page/schema/documentV1'
import type { FanPageDevice } from '@/lib/fan-page/editor/store'
import type { Artist, Release, Concert, Video } from '@/types'
import { FanPageBlockRenderer, type FanPageLiveData } from '@/components/fan-page/FanPageBlockRenderer'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'

interface FanPagePublicViewProps {
  document: LandingPageDocumentV1
  artist: Artist
  releases: Release[]
  concerts: Concert[]
  videos: Video[]
}

export function FanPagePublicView({
  document,
  artist,
  releases,
  concerts,
  videos,
}: FanPagePublicViewProps) {
  const [device, setDevice] = useState<FanPageDevice>('desktop')

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setDevice(mq.matches ? 'mobile' : 'desktop')
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const colors = resolveThemeColors(document.theme)
  const sections = [...document.sections].sort((a, b) => a.order - b.order)

  const liveData: FanPageLiveData = {
    artist,
    releases,
    concerts,
    videos,
    smartLinks: artist.smartLinks,
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.background, color: colors.text }}>
      {sections.map((section) => (
        <FanPageBlockRenderer
          key={section.id}
          section={section}
          theme={document.theme}
          device={device}
          liveData={liveData}
        />
      ))}
    </div>
  )
}