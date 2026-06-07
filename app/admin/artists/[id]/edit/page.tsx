'use client'

import { useMemo, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Envelope } from '@phosphor-icons/react'
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
    spotifyUrl: artist.spotifyUrl ?? '',
    appleMusicUrl: artist.appleMusicUrl ?? '',
    instagramUrl: artist.instagramUrl ?? '',
    youtubeUrl: artist.youtubeUrl ?? '',
    websiteUrl: artist.websiteUrl ?? '',
    facebookUrl: artist.facebookUrl ?? '',
    twitterUrl: artist.twitterUrl ?? '',
    tiktokUrl: artist.tiktokUrl ?? '',
    bandcampUrl: artist.bandcampUrl ?? '',
    shopUrl: artist.shopUrl ?? '',
    country: artist.country ?? '',
    foundedYear: artist.foundedYear ? String(artist.foundedYear) : '',
    email: artist.email ?? '',
    vatNumber: artist.vatNumber ?? '',
    featured: artist.featured,
    isEuNonGerman: artist.isEuNonGerman ?? false,
    isVisible: artist.isVisible,
    notes: artist.notes ?? '',
    spotifyId: artist.spotifyId ?? '',
    discogsId: artist.discogsId ?? '',
    songkickId: artist.songkickId ?? '',
    bandsintownId: artist.bandsintownId ?? '',
    storageQuotaMb: artist.storageQuotaBytes != null
      ? String(Math.round(artist.storageQuotaBytes / (1024 * 1024)))
      : '',
    smartLinks: artist.smartLinks ?? [],
    imagePositionX: artist.imagePositionX ?? 50,
    imagePositionY: artist.imagePositionY ?? 50,
    imageScale: artist.imageScale ?? 1,
  }
}

function formDataToInsert(data: ArtistFormData): ArtistInsert {
  const quotaMb = data.storageQuotaMb ? parseInt(data.storageQuotaMb, 10) : null
  return {
    name: data.name,
    slug: data.slug,
    bio: data.bio || null,
    genres: data.genres.split(',').map((g) => g.trim()).filter(Boolean),
    image_url: data.imageUrl || null,
    logo_url: data.logoUrl || null,
    spotify_url: data.spotifyUrl || null,
    apple_music_url: data.appleMusicUrl || null,
    instagram_url: data.instagramUrl || null,
    youtube_url: data.youtubeUrl || null,
    website_url: data.websiteUrl || null,
    facebook_url: data.facebookUrl || null,
    twitter_url: data.twitterUrl || null,
    tiktok_url: data.tiktokUrl || null,
    bandcamp_url: data.bandcampUrl || null,
    shop_url: data.shopUrl || null,
    country: data.country || null,
    founded_year: data.foundedYear ? parseInt(data.foundedYear, 10) : null,
    email: data.email || null,
    vat_number: data.vatNumber || null,
    featured: data.featured,
    is_eu_non_german: data.isEuNonGerman,
    is_visible: data.isVisible,
    notes: data.notes || null,
    spotify_id: data.spotifyId || null,
    discogs_id: data.discogsId || null,
    songkick_id: data.songkickId || null,
    bandsintown_id: data.bandsintownId || null,
    storage_quota_bytes: quotaMb != null && !Number.isNaN(quotaMb) ? quotaMb * 1024 * 1024 : null,
    smart_links: data.smartLinks?.length ? data.smartLinks : null,
    image_position_x: data.imagePositionX,
    image_position_y: data.imagePositionY,
    image_scale: data.imageScale,
  }
}

export default function ArtistEditPage() {
  const params = useParams()
  const router = useRouter()
  const artistId = params['id'] as string

  const { artists, isLoading, updateArtist } = useArtists()
  const [isSaving, setIsSaving] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const artist = useMemo(() => artists.find((a) => a.id === artistId), [artists, artistId])
  const formValue = useMemo(() => (artist ? artistToFormData(artist) : null), [artist])

  // Redirect to admin if artist not found once loading is complete
  useEffect(() => {
    if (!isLoading && artists.length > 0 && !artist) {
      toast.error('Artist not found')
      router.push('/admin/content?tab=artists')
    }
  }, [isLoading, artists.length, artist, router])

  const handleInvite = async () => {
    if (!artist) return
    setIsInviting(true)
    try {
      const res = await fetch(`/api/admin/artists/${artist.id}/invite`, { method: 'POST' })
      const json = (await res.json()) as { ok: boolean; email?: string; error?: string }
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? 'Failed to send invite')
      } else {
        toast.success(`Invite sent to ${json.email ?? artist.email ?? 'artist'}`)
      }
    } catch {
      toast.error('Failed to send invite')
    } finally {
      setIsInviting(false)
    }
  }

  const handleSave = async (data: ArtistFormData) => {
    if (!artist) return
    setIsSaving(true)
    try {
      await updateArtist(artist.id, formDataToInsert(data))
      toast.success(`Updated "${data.name}"`)

      // Trigger release sync if Spotify ID changed
      if (data.spotifyId && data.spotifyId !== artist.spotifyId) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          void fetch('/api/sync-artist', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + session.access_token,
            },
            body: JSON.stringify({ artistId: artist.id }),
          }).then(() => toast.success('Release sync triggered'))
        }
      }

      router.push('/admin/content?tab=artists')
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
            <Link href="/admin/content?tab=artists">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Artists
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Artist Details</CardTitle>
              {artist?.email && !artist.userId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleInvite()}
                  disabled={isInviting}
                  className="gap-2"
                >
                  <Envelope size={16} aria-hidden="true" />
                  {isInviting ? 'Sending…' : 'Send Portal Invite'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <ArtistForm value={formValue} onChange={handleSave} isLoading={isSaving} artistId={artistId} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
