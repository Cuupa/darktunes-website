'use client'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import type { SiteSettings } from '@/types'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const schema = z.object({
  labelName: z.string().min(1, 'Label name is required'),
  labelTagline: z.string().min(1, 'Tagline is required'),
  contactEmail: z.string().email('Must be a valid email'),
  privacyPolicyUrl: z.string().url('Must be a valid URL'),
  termsUrl: z.string().url('Must be a valid URL'),
  instagramUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  youtubeUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  spotifyUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  spotifyPlaylistUri: z.string().min(1, 'Spotify playlist URI is required'),
  heroBadge: z.string().min(1, 'Hero badge text is required'),
  heroDescription: z.string().min(1, 'Hero description is required'),
  seoTitle: z.string().min(1, 'SEO title is required'),
  seoDescription: z.string().min(1, 'SEO description is required'),
  ogTitle: z.string().min(1, 'OG title is required'),
  ogDescription: z.string().min(1, 'OG description is required'),
})

type FormData = z.infer<typeof schema>

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

interface FieldProps {
  id: string
  label: string
  error?: string
  disabled?: boolean
  children: React.ReactNode
}

function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SiteSettingsManager() {
  const { settings, isLoading, saveSettings } = useSiteSettings()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: settings,
  })

  // Sync form state when settings load from Supabase
  useEffect(() => {
    reset(settings)
  }, [settings, reset])

  const onSubmit = async (data: FormData) => {
    try {
      await saveSettings(data as SiteSettings)
      toast.success('Site settings saved successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Tabs defaultValue="global" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="global">Global</TabsTrigger>
          <TabsTrigger value="social">Social Links</TabsTrigger>
          <TabsTrigger value="homepage">Homepage</TabsTrigger>
          <TabsTrigger value="seo">SEO / Meta</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------ */}
        {/* Global                                                               */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="global">
          <Card>
            <CardHeader>
              <CardTitle>Global Settings</CardTitle>
              <CardDescription>
                Core identity values shown across the entire site (footer, header, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="labelName" label="Label Name *" error={errors.labelName?.message}>
                <Input id="labelName" {...register('labelName')} disabled={isSubmitting} />
              </Field>

              <Field id="labelTagline" label="Label Tagline *" error={errors.labelTagline?.message}>
                <Input id="labelTagline" {...register('labelTagline')} disabled={isSubmitting} />
              </Field>

              <Field
                id="contactEmail"
                label="Contact Email *"
                error={errors.contactEmail?.message}
              >
                <Input
                  id="contactEmail"
                  type="email"
                  {...register('contactEmail')}
                  disabled={isSubmitting}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field
                  id="privacyPolicyUrl"
                  label="Privacy Policy URL *"
                  error={errors.privacyPolicyUrl?.message}
                >
                  <Input
                    id="privacyPolicyUrl"
                    {...register('privacyPolicyUrl')}
                    disabled={isSubmitting}
                  />
                </Field>
                <Field id="termsUrl" label="Terms URL *" error={errors.termsUrl?.message}>
                  <Input id="termsUrl" {...register('termsUrl')} disabled={isSubmitting} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Social Links                                                         */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle>Social Links</CardTitle>
              <CardDescription>
                URLs shown in the footer social icons. Leave blank to hide an icon.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                id="instagramUrl"
                label="Instagram URL"
                error={errors.instagramUrl?.message}
              >
                <Input
                  id="instagramUrl"
                  placeholder="https://instagram.com/..."
                  {...register('instagramUrl')}
                  disabled={isSubmitting}
                />
              </Field>

              <Field id="youtubeUrl" label="YouTube URL" error={errors.youtubeUrl?.message}>
                <Input
                  id="youtubeUrl"
                  placeholder="https://youtube.com/@..."
                  {...register('youtubeUrl')}
                  disabled={isSubmitting}
                />
              </Field>

              <Field id="spotifyUrl" label="Spotify Profile URL" error={errors.spotifyUrl?.message}>
                <Input
                  id="spotifyUrl"
                  placeholder="https://open.spotify.com/user/..."
                  {...register('spotifyUrl')}
                  disabled={isSubmitting}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Homepage                                                             */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="homepage">
          <Card>
            <CardHeader>
              <CardTitle>Homepage Content</CardTitle>
              <CardDescription>
                Text and media shown on the public homepage (hero section, Spotify player).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="heroBadge" label="Hero Badge Text *" error={errors.heroBadge?.message}>
                <Input
                  id="heroBadge"
                  placeholder="e.g. ⚡ New Release"
                  {...register('heroBadge')}
                  disabled={isSubmitting}
                />
              </Field>

              <Field
                id="heroDescription"
                label="Hero Description *"
                error={errors.heroDescription?.message}
              >
                <Textarea
                  id="heroDescription"
                  rows={3}
                  {...register('heroDescription')}
                  disabled={isSubmitting}
                />
              </Field>

              <Field
                id="spotifyPlaylistUri"
                label="Spotify Playlist URI *"
                error={errors.spotifyPlaylistUri?.message}
              >
                <Input
                  id="spotifyPlaylistUri"
                  placeholder="e.g. 37i9dQZF1DWWqNV5cS50j6"
                  {...register('spotifyPlaylistUri')}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The playlist ID from the Spotify share link (not the full URL).
                </p>
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* SEO / Meta                                                           */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="seo">
          <Card>
            <CardHeader>
              <CardTitle>SEO &amp; Meta Tags</CardTitle>
              <CardDescription>
                Page title, meta description, and Open Graph tags used by search engines and
                social previews.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="seoTitle" label="Page Title *" error={errors.seoTitle?.message}>
                <Input id="seoTitle" {...register('seoTitle')} disabled={isSubmitting} />
              </Field>

              <Field
                id="seoDescription"
                label="Meta Description *"
                error={errors.seoDescription?.message}
              >
                <Textarea
                  id="seoDescription"
                  rows={2}
                  {...register('seoDescription')}
                  disabled={isSubmitting}
                />
              </Field>

              <Field id="ogTitle" label="OG Title *" error={errors.ogTitle?.message}>
                <Input id="ogTitle" {...register('ogTitle')} disabled={isSubmitting} />
              </Field>

              <Field id="ogDescription" label="OG Description *" error={errors.ogDescription?.message}>
                <Textarea
                  id="ogDescription"
                  rows={2}
                  {...register('ogDescription')}
                  disabled={isSubmitting}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
          {isSubmitting ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </form>
  )
}
