import Image from 'next/image'
import type { Dictionary } from '@/i18n/types'

interface EPKPreviewProps {
  dict: Dictionary['portal']
  artistName: string
  photoUrl?: string
  bioShort?: string
  bioMedium?: string
  bioLong?: string
  pressQuote?: string
  genres?: string
  websiteUrl?: string
  instagramUrl?: string
  youtubeUrl?: string
  bandcampUrl?: string
}

export function EPKPreview({
  dict,
  artistName,
  photoUrl,
  bioShort,
  bioMedium,
  bioLong,
  pressQuote,
  genres,
  websiteUrl,
  instagramUrl,
  youtubeUrl,
  bandcampUrl,
}: EPKPreviewProps) {
  const links = [websiteUrl, instagramUrl, youtubeUrl, bandcampUrl].filter(Boolean) as string[]

  return (
    <section className="epk-print-area rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-2xl font-semibold">{dict.profile_epk_preview_heading}</h2>
      <div className="space-y-4">
        <h3 className="text-xl font-bold">{artistName}</h3>
        {photoUrl && (
          <div className="relative h-40 w-40">
            <Image src={photoUrl} alt={`${artistName} – artist photo`} fill loading="lazy" className="rounded-md object-cover" />
          </div>
        )}
        {genres && <p><strong>{dict.profile_genres}:</strong> {genres}</p>}
        {bioShort && <p>{bioShort}</p>}
        {bioMedium && <p>{bioMedium}</p>}
        {bioLong && <p>{bioLong}</p>}
        {pressQuote && <blockquote className="border-l-2 border-primary pl-3 italic">“{pressQuote}”</blockquote>}
        {links.length > 0 && (
          <ul className="list-disc pl-5">
            {links.map((link) => (
              <li key={link} className="break-all">
                <a href={link} target="_blank" rel="noopener noreferrer" className="underline">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
