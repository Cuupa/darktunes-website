'use client'

import { useMemo, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArtistForm, type ArtistFormData } from '@/components/admin/forms/ArtistForm'
import { useArtists } from '@/hooks/useArtists'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Artist } from '@/types'
import type { Database } from '@/types/database'

type ArtistInsert = Database['public']['Tables']['artists']['Insert']

function artistToFormData(artist: Artist): ArtistFormData {
  return {
    name: artist.name,
    slug: artist.slug,
    bio: artist.bio ?? '',
    genres: artist.genres.join(', '),
    imageUrl: artist.imageUrl ?? '',
    logoUrl: artist.logoUrl ?? '',
    country: artist.country ?? '',
    website: artist.website ?? '',
    spotifyArtistId: artist.spotifyArtistId ?? '',
    spotifyUrl: artist.spotifyUrl ?? '',
    appleMusicUrl: artist.appleMusicUrl ?? '',
    discogsUrl: artist.discogsUrl ?? '',
    deezerUrl: artist.deezerUrl ?? '',
    amazonMusicUrl: artist.amazonMusicUrl ?? '',
    youtubeChannelUrl: artist.youtubeChannelUrl ?? '',
    youtubeChannelId: artist.youtubeChannelId ?? '',
    instagramUrl: artist.instagramUrl ?? '',
    facebookUrl: artist.facebookUrl ?? '',
    twitterUrl: artist.twitterUrl ?? '',
    bandcampUrl: artist.bandcampUrl ?? '',
    soundcloudUrl: artist.soundcloudUrl ?? '',
    active: artist.active ?? true,
    featured: artist.featured ?? false,
    autoSync: artist.autoSync ?? true,
  }
}

function formDataToInsert(data: ArtistFormData): ArtistInsert {
  return {
    name: data.name,
    slug: data.slug,
    bio: data.bio || null,
    genres: data.genres.split(',').map((g) => g.trim()).filter(Boolean),
    image_url: data.imageUrl || null,
    logo_url: data.logoUrl || null,
    country: data.country || null,
    website: data.website || null,
    spotify_artist_id: data.spotifyArtistId || null,
    spotify_url: data.spotifyUrl || null,
    apple_music_url: data.appleMusicUrl || null,
    discogs_url: data.discogsUrl || null,
    deezer_url: data.deezerUrl || null,
    amazon_music_url: data.amazonMusicUrl || null,
    youtube_channel_url: data.youtubeChannelUrl || null,
    youtube_channel_id: data.youtubeChannelId || null,
    instagram_url: data.instagramUrl || null,
    facebook_url: data.facebookUrl || null,
    twitter_url: data.twitterUrl || null,
    bandcamp_url: data.bandcampUrl || null,
    soundcloud_url: data.soundcloudUrl || null,
    active: data.active ?? true,
    featured: data.featured ?? false,
    auto_sync: data.autoSync ?? true,
  }
}

export default function ArtistEditPage() {
  const params = useParams()
  const router = useRouter()
  const artistId = params['id'] as string

  const { artists, isLoading, updateArtist } = useArtists()
  const [isSaving, setIsSaving] = useState(false)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const artist = useMemo(() => artists.find((a) => a.id === artistId), [artists, artistId])
  const formValue = useMemo(() => (artist ? artistToFormData(artist) : null), [artist])

  // Redirect to admin if artist not found once loading is complete
  useEffect(() => {
    if (!isLoading && artists.length > 0 && !artist) {
      toast.error('Artist not found')
      router.push('/admin')
    }
  }, [isLoading, artists.length, artist, router])

  const handleSave = async (data: ArtistFormData) => {
    if (!artist) return
    setIsSaving(true)
    try {
      // Re-sync Spotify if artist ID changed
      await updateArtist(artist.id, formDataToInsert(data))
      toast.success(`Updated "${data.name}"`)

      // Trigger release sync if Spotify ID changed
      if (data.spotifyArtistId && data.spotifyArtistId !== artist.spotifyArtistId) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          const token = session.access_token
          void fetch('/api/sync-artist', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token,
            },
            body: JSON.stringify({ artistId: artist.id }),
          }).then(() => toast.success('Release sync triggered'))
        }
      }

      router.push('/admin')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Admin
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            {isLoading ? 'Loading…' : artist ? `Edit Artist: ${artist.name}` : 'Artist not found'}
          </h1>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        )}

        {!isLoading && formValue && (
          <Card>
            <CardHeader>
              <CardTitle>Artist Details</CardTitle>
            </CardHeader>
            <CardContent>
              <ArtistForm value={formValue} onChange={handleSave} isLoading={isSaving} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
