import type { Release, Video } from '@/types'
import type { EpkDocumentV2, EpkElement } from '@/lib/epk/schema/documentV2'
import { createEpkElementId } from '@/lib/epk/schema/elementIds'
import { getNextZIndex } from './defaults'

function formatReleaseLine(release: Release): string {
  const typeLabel = release.type.toUpperCase()
  const link = release.smartlinkUrl ?? release.spotifyUrl ?? `/releases/${release.id}`
  return `• ${release.title} (${typeLabel}) — ${release.releaseDate} — ${link}`
}

function formatVideoLine(video: Video): string {
  const url = `https://www.youtube.com/watch?v=${video.youtubeId}`
  return `• ${video.title} — ${url}`
}

export function buildCatalogImportElement(
  pageId: string,
  document: EpkDocumentV2,
  releases: Release[],
  videos: Video[],
): EpkElement | null {
  const sections: string[] = []

  if (releases.length > 0) {
    sections.push('Releases', ...releases.map(formatReleaseLine), '')
  }

  if (videos.length > 0) {
    sections.push('Videos', ...videos.map(formatVideoLine))
  }

  if (sections.length === 0) return null

  const content = sections.join('\n').trim()
  const lineCount = content.split('\n').length
  const page = document.pages.find((p) => p.id === pageId)
  const y = (page?.height ?? 1123) * 0.32

  return {
    id: createEpkElementId('text'),
    pageId,
    type: 'text',
    x: 48,
    y,
    width: (page?.width ?? 794) - 96,
    height: Math.min(420, 48 + lineCount * 18),
    rotation: 0,
    zIndex: getNextZIndex(document, pageId),
    locked: false,
    visible: true,
    role: 'links',
    content,
    style: {
      fill: '#e8e8e8',
      fontSize: 12,
      fontFamily: 'Helvetica, Arial, sans-serif',
      textAlign: 'left',
      lineHeight: 1.5,
    },
  }
}