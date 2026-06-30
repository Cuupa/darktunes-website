'use client'

import type { FanPageSection, FanPageTheme, FanPageImageProps } from '@/lib/fan-page/schema/documentV1'
import type { FanPageDevice } from '@/lib/fan-page/editor/store'
import type { Artist, Release, Concert, Video } from '@/types'
import { FanPageSectionShell } from './blocks/FanPageSectionShell'
import { HeroBlock } from './blocks/HeroBlock'
import { BioBlock } from './blocks/BioBlock'
import { ReleaseGridBlock } from './blocks/ReleaseGridBlock'
import { MusicPlayerBlock } from './blocks/MusicPlayerBlock'
import { TourDatesBlock } from './blocks/TourDatesBlock'
import { SmartLinksBlock } from './blocks/SmartLinksBlock'
import { NewsletterBlock } from './blocks/NewsletterBlock'
import { GalleryBlock } from './blocks/GalleryBlock'
import { VideoGridBlock } from './blocks/VideoGridBlock'
import { MerchBlock } from './blocks/MerchBlock'
import { CtaBannerBlock } from './blocks/CtaBannerBlock'
import { SpacerBlock } from './blocks/SpacerBlock'

export interface FanPageLiveData {
  artist?: Artist
  releases?: Release[]
  concerts?: Concert[]
  videos?: Video[]
  smartLinks?: Array<{ label: string; url: string }>
}

interface FanPageBlockRendererProps {
  section: FanPageSection
  theme: FanPageTheme
  device: FanPageDevice
  liveData?: FanPageLiveData
  selected?: boolean
  onSelect?: (id: string) => void
}

function prop<T>(props: Record<string, unknown>, key: string): T | undefined {
  return props[key] as T | undefined
}

export function FanPageBlockRenderer({
  section,
  theme,
  device,
  liveData,
  selected,
  onSelect,
}: FanPageBlockRendererProps) {
  const { props } = section
  const artist = liveData?.artist

  const content = (() => {
    switch (section.type) {
      case 'hero':
        return (
          <HeroBlock
            headline={prop<string>(props, 'headline')}
            subheadline={prop<string>(props, 'subheadline')}
            image={prop<FanPageImageProps>(props, 'image')}
            showCountdown={prop<boolean>(props, 'showCountdown')}
            compact={prop<boolean>(props, 'compact')}
            theme={theme}
            artistName={artist?.name}
          />
        )
      case 'bio':
        return <BioBlock content={prop<string>(props, 'content')} title={prop<string>(props, 'title')} />
      case 'release_grid':
        return (
          <ReleaseGridBlock
            limit={prop<number>(props, 'limit')}
            releases={liveData?.releases}
            theme={theme}
            title={prop<string>(props, 'title')}
          />
        )
      case 'music_player':
        return (
          <MusicPlayerBlock
            artist={artist}
            theme={theme}
            title={prop<string>(props, 'title')}
            spotifyUri={prop<string>(props, 'spotifyUri')}
          />
        )
      case 'tour_dates':
        return (
          <TourDatesBlock
            concerts={liveData?.concerts}
            theme={theme}
            title={prop<string>(props, 'title')}
            limit={prop<number>(props, 'limit')}
          />
        )
      case 'smart_links':
        return (
          <SmartLinksBlock
            artist={artist}
            smartLinks={liveData?.smartLinks}
            theme={theme}
            title={prop<string>(props, 'title')}
          />
        )
      case 'newsletter_signup':
        return (
          <NewsletterBlock
            theme={theme}
            heading={prop<string>(props, 'heading')}
            description={prop<string>(props, 'description')}
          />
        )
      case 'gallery':
        return (
          <GalleryBlock
            images={prop<FanPageImageProps[]>(props, 'images')}
            theme={theme}
            title={prop<string>(props, 'title')}
            columns={prop<number>(props, 'columns')}
          />
        )
      case 'video_grid':
        return (
          <VideoGridBlock
            videos={liveData?.videos}
            theme={theme}
            title={prop<string>(props, 'title')}
            limit={prop<number>(props, 'limit')}
          />
        )
      case 'merch_shelf':
        return (
          <MerchBlock
            shopUrl={prop<string>(props, 'shopUrl') ?? artist?.shopUrl}
            image={prop<FanPageImageProps>(props, 'image')}
            theme={theme}
            title={prop<string>(props, 'title')}
            ctaLabel={prop<string>(props, 'ctaLabel')}
          />
        )
      case 'cta_banner':
        return (
          <CtaBannerBlock
            label={prop<string>(props, 'label')}
            url={prop<string>(props, 'url')}
            headline={prop<string>(props, 'headline')}
            image={prop<FanPageImageProps>(props, 'image')}
            theme={theme}
          />
        )
      case 'spacer':
        return <SpacerBlock size={prop<string>(props, 'size')} />
      default:
        return null
    }
  })()

  return (
    <FanPageSectionShell
      section={section}
      theme={theme}
      device={device}
      selected={selected}
      onClick={onSelect ? () => onSelect(section.id) : undefined}
    >
      {content}
    </FanPageSectionShell>
  )
}