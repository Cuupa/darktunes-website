'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { SiteSettings } from '@/types'
import type { AdminPanelProps } from '@/lib/component-contracts'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const schema = z.object({
  labelName: z.string().min(1, 'Label name is required'),
  labelTagline: z.string().min(1, 'Tagline is required'),
  contactEmail: z.string().email('Must be a valid email'),
  privacyPolicyUrl: z.string().min(1, 'Privacy policy URL or path is required'),
  termsUrl: z.string().min(1, 'Terms URL or path is required'),
  instagramUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  youtubeUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  spotifyUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  spotifyPlaylistUri: z.string().min(1, 'Spotify playlist URI is required'),
  spotifyPlaylists: z.array(
    z.object({
      label: z.string().min(1, 'Label required'),
      uri: z.string().min(1, 'URI required'),
    }),
  ).default([]).refine(
    (entries) => new Set(entries.map((entry) => entry.uri.trim())).size === entries.length,
    { message: 'Playlist URIs must be unique' },
  ),
  heroBadge: z.string().min(1, 'Hero badge text is required'),
  heroDescription: z.string().min(1, 'Hero description is required'),
  seoTitle: z.string().min(1, 'SEO title is required'),
  seoDescription: z.string().min(1, 'SEO description is required'),
  ogTitle: z.string().min(1, 'OG title is required'),
  ogDescription: z.string().min(1, 'OG description is required'),
  impressumCompanyName: z.string().min(1, 'Company name is required'),
  impressumLegalForm: z.string().optional().default(''),
  impressumRepresentative: z.string().optional().default(''),
  impressumAddress: z.string().optional().default(''),
  impressumVatId: z.string().optional().default(''),
  impressumRegisterCourt: z.string().optional().default(''),
  impressumRegisterNumber: z.string().optional().default(''),
  impressumPhone: z.string().optional().default(''),
  impressumEmail: z.string().email('Must be a valid email').or(z.literal('')),
  datenschutzContent: z.string().optional().default(''),
  consentPlaceholderUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  noiseOpacity: z.number().min(0).max(1).default(0.04),
  crtScanlinesEnabled: z.boolean().default(true),
  vignetteIntensity: z.number().min(0).max(1).default(0.5),
  carouselAutoplayMs: z.number().int().min(0).default(0),
  logoUrl: z.string().optional().default(''),
  faviconUrl: z.string().optional().default(''),
  aboutHeadline: z.string().optional().default(''),
  aboutSubheading: z.string().optional().default(''),
  aboutBody: z.string().optional().default(''),
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

export function SiteSettingsManager({ value: settings, onChange: saveSettings, isLoading }: AdminPanelProps<SiteSettings>) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: settings,
  })
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'spotifyPlaylists',
  })

  const logoUrl = watch('logoUrl')
  const faviconUrl = watch('faviconUrl')

  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  async function uploadFile(file: File, fieldName: 'logoUrl' | 'faviconUrl', setUploading: (v: boolean) => void) {
    setUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`)
      const json = await res.json() as { publicUrl: string }
      setValue(fieldName, json.publicUrl, { shouldDirty: true })
      toast.success('File uploaded successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

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
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="global">Global</TabsTrigger>
          <TabsTrigger value="branding">Logo &amp; Favicon</TabsTrigger>
          <TabsTrigger value="about">About Page</TabsTrigger>
          <TabsTrigger value="social">Social Links</TabsTrigger>
          <TabsTrigger value="homepage">Homepage</TabsTrigger>
          <TabsTrigger value="seo">SEO / Meta</TabsTrigger>
          <TabsTrigger value="legal">Legal / DSGVO</TabsTrigger>
          <TabsTrigger value="visual">Visual Effects</TabsTrigger>
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
        {/* Branding — Logo & Favicon                                           */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Logo &amp; Favicon</CardTitle>
              <CardDescription>
                Upload a custom logo (shown in the header and footer) and a favicon (shown in the browser tab).
                Leave blank to fall back to the default static assets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Logo */}
              <div className="space-y-3">
                <Label>Label Logo</Label>
                {logoUrl && (
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <img src={logoUrl} alt="Current logo" className="h-12 w-auto object-contain max-w-[200px]" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setValue('logoUrl', '', { shouldDirty: true })}
                      disabled={isSubmitting}
                    >
                      Remove
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void uploadFile(file, 'logoUrl', setIsUploadingLogo)
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isSubmitting || isUploadingLogo}
                  >
                    {isUploadingLogo ? 'Uploading…' : logoUrl ? 'Replace Logo' : 'Upload Logo'}
                  </Button>
                  <span className="text-xs text-muted-foreground">PNG, SVG, or WebP recommended · transparent background preferred</span>
                </div>
                <Input
                  placeholder="Or paste R2 URL directly…"
                  {...register('logoUrl')}
                  disabled={isSubmitting}
                />
              </div>

              {/* Favicon */}
              <div className="space-y-3">
                <Label>Favicon</Label>
                {faviconUrl && (
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <img src={faviconUrl} alt="Current favicon" className="h-8 w-8 object-contain" />
                    <span className="text-sm text-muted-foreground font-mono truncate max-w-xs">{faviconUrl}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setValue('faviconUrl', '', { shouldDirty: true })}
                      disabled={isSubmitting}
                    >
                      Remove
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/x-icon,image/png,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void uploadFile(file, 'faviconUrl', setIsUploadingFavicon)
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={isSubmitting || isUploadingFavicon}
                  >
                    {isUploadingFavicon ? 'Uploading…' : faviconUrl ? 'Replace Favicon' : 'Upload Favicon'}
                  </Button>
                  <span className="text-xs text-muted-foreground">ICO or 32×32 PNG recommended</span>
                </div>
                <Input
                  placeholder="Or paste R2 URL directly…"
                  {...register('faviconUrl')}
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* About Page                                                           */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>About Page Content</CardTitle>
              <CardDescription>
                Manage all text shown on <code>/about</code>. Leave headline/subheading blank to use the default i18n values.
                The body supports Markdown (headings, bold, italic, links, lists).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="aboutHeadline" label="Headline (optional — overrides i18n default)">
                <Input
                  id="aboutHeadline"
                  placeholder="e.g. ABOUT DARKTUNES"
                  {...register('aboutHeadline')}
                  disabled={isSubmitting}
                />
              </Field>

              <Field id="aboutSubheading" label="Subheading (optional — overrides i18n default)">
                <Input
                  id="aboutSubheading"
                  placeholder="e.g. The creative force behind the sound"
                  {...register('aboutSubheading')}
                  disabled={isSubmitting}
                />
              </Field>

              <Field id="aboutBody" label="Body Text (Markdown)">
                <Textarea
                  id="aboutBody"
                  rows={16}
                  placeholder={`## Our Story\n\nWe are darkTunes Music Group...\n\n## Mission\n\nPushing boundaries in alternative music.`}
                  {...register('aboutBody')}
                  disabled={isSubmitting}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports: ## headings, **bold**, *italic*, [links](url), - list items, {'>'} blockquotes.
                  Bare YouTube URLs on their own line embed as videos.
                </p>
              </Field>
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

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Label>Spotify Playlists (Tabs)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ label: '', uri: '' })}
                    disabled={isSubmitting}
                  >
                    + Add playlist
                  </Button>
                </div>

                {fields.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No additional playlists configured. The website will fall back to the “Spotify
                    Playlist URI” field above.
                  </p>
                )}

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-start">
                      <div className="space-y-1">
                        <Input
                          placeholder="Label (e.g. Darkwave Mix)"
                          {...register(`spotifyPlaylists.${index}.label` as const)}
                          disabled={isSubmitting}
                        />
                        {errors.spotifyPlaylists?.[index]?.label?.message && (
                          <p className="text-xs text-destructive">
                            {errors.spotifyPlaylists[index]?.label?.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Input
                          placeholder="URI or URL"
                          {...register(`spotifyPlaylists.${index}.uri` as const)}
                          disabled={isSubmitting}
                        />
                        {errors.spotifyPlaylists?.[index]?.uri?.message && (
                          <p className="text-xs text-destructive">
                            {errors.spotifyPlaylists[index]?.uri?.message}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        disabled={isSubmitting}
                        className="justify-self-start md:justify-self-end"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                {typeof errors.spotifyPlaylists?.message === 'string' && (
                  <p className="text-xs text-destructive">{errors.spotifyPlaylists.message}</p>
                )}
              </div>

              <Field id="carouselAutoplayMs" label="Carousel Auto-Advance (ms)">
                <Input
                  id="carouselAutoplayMs"
                  type="number"
                  min={0}
                  step={500}
                  {...register('carouselAutoplayMs', { valueAsNumber: true })}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Milliseconds between automatic slide advances. 0 = disabled (recommended default).
                  E.g. 5000 = 5 seconds.
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

        {/* ------------------------------------------------------------------ */}
        {/* Legal / DSGVO                                                        */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="legal">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Impressum (§ 5 TMG)</CardTitle>
                <CardDescription>
                  Pflichtangaben für das Impressum nach deutschem Recht. Diese Daten erscheinen auf
                  der Seite /impressum.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field
                  id="impressumCompanyName"
                  label="Firmenname *"
                  error={errors.impressumCompanyName?.message}
                >
                  <Input
                    id="impressumCompanyName"
                    {...register('impressumCompanyName')}
                    disabled={isSubmitting}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field id="impressumLegalForm" label="Rechtsform" error={errors.impressumLegalForm?.message}>
                    <Input
                      id="impressumLegalForm"
                      placeholder="z.B. GmbH, UG, GbR"
                      {...register('impressumLegalForm')}
                      disabled={isSubmitting}
                    />
                  </Field>
                  <Field id="impressumRepresentative" label="Vertretungsberechtigte(r)" error={errors.impressumRepresentative?.message}>
                    <Input
                      id="impressumRepresentative"
                      placeholder="Vorname Nachname"
                      {...register('impressumRepresentative')}
                      disabled={isSubmitting}
                    />
                  </Field>
                </div>

                <Field id="impressumAddress" label="Anschrift" error={errors.impressumAddress?.message}>
                  <Textarea
                    id="impressumAddress"
                    rows={3}
                    placeholder="Musterstraße 1&#10;12345 Musterstadt&#10;Deutschland"
                    {...register('impressumAddress')}
                    disabled={isSubmitting}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field id="impressumPhone" label="Telefon" error={errors.impressumPhone?.message}>
                    <Input
                      id="impressumPhone"
                      type="tel"
                      placeholder="+49 30 ..."
                      {...register('impressumPhone')}
                      disabled={isSubmitting}
                    />
                  </Field>
                  <Field id="impressumEmail" label="E-Mail" error={errors.impressumEmail?.message}>
                    <Input
                      id="impressumEmail"
                      type="email"
                      {...register('impressumEmail')}
                      disabled={isSubmitting}
                    />
                  </Field>
                </div>

                <Field id="impressumVatId" label="USt-IdNr. (§ 27a UStG)" error={errors.impressumVatId?.message}>
                  <Input
                    id="impressumVatId"
                    placeholder="DE123456789"
                    {...register('impressumVatId')}
                    disabled={isSubmitting}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field id="impressumRegisterCourt" label="Registergericht" error={errors.impressumRegisterCourt?.message}>
                    <Input
                      id="impressumRegisterCourt"
                      placeholder="Amtsgericht Berlin"
                      {...register('impressumRegisterCourt')}
                      disabled={isSubmitting}
                    />
                  </Field>
                  <Field id="impressumRegisterNumber" label="Registernummer" error={errors.impressumRegisterNumber?.message}>
                    <Input
                      id="impressumRegisterNumber"
                      placeholder="HRB 12345"
                      {...register('impressumRegisterNumber')}
                      disabled={isSubmitting}
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Datenschutzerklärung</CardTitle>
                <CardDescription>
                  Volltext der Datenschutzerklärung in Markdown. Erscheint auf /datenschutz.
                  Leer lassen für Standard-Boilerplate.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field
                  id="datenschutzContent"
                  label="Datenschutztext (Markdown)"
                  error={errors.datenschutzContent?.message}
                >
                  <Textarea
                    id="datenschutzContent"
                    rows={12}
                    placeholder="## 1. Datenschutz auf einen Blick&#10;..."
                    {...register('datenschutzContent')}
                    disabled={isSubmitting}
                    className="font-mono text-xs"
                  />
                </Field>

                <Field
                  id="consentPlaceholderUrl"
                  label="Consent-Platzhalterbild (R2 URL)"
                  error={errors.consentPlaceholderUrl?.message}
                >
                  <Input
                    id="consentPlaceholderUrl"
                    placeholder="https://cdn.darktunes.com/consent-placeholder.jpg"
                    {...register('consentPlaceholderUrl')}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Bild aus dem R2-Bucket, das angezeigt wird, bevor der Nutzer externen Inhalten
                    (Spotify, YouTube) zugestimmt hat.
                  </p>
                </Field>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* ------------------------------------------------------------------ */}
        {/* Visual Effects                                                       */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="visual">
          <Card>
            <CardHeader>
              <CardTitle>Visual Effects</CardTitle>
              <CardDescription>
                Configure the industrial dark-aesthetic overlays rendered on the public site. All
                effects are non-interactive and sit beneath UI elements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Noise / Grain */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Noise / Grain Opacity</Label>
                  <Controller
                    name="noiseOpacity"
                    control={control}
                    render={({ field }) => (
                      <span className="text-sm text-muted-foreground tabular-nums w-10 text-right">
                        {(field.value ?? 0).toFixed(2)}
                      </span>
                    )}
                  />
                </div>
                <Controller
                  name="noiseOpacity"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={[field.value ?? 0]}
                      onValueChange={([v]) => field.onChange(v)}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  0 = invisible · 0.04 = subtle (recommended) · 0.15 = heavy grain
                </p>
              </div>

              {/* CRT Scanlines */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="crtScanlinesEnabled">CRT Scanlines</Label>
                  <p className="text-xs text-muted-foreground">
                    Horizontal line pattern for a subtle industrial CRT look.
                  </p>
                </div>
                <Controller
                  name="crtScanlinesEnabled"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="crtScanlinesEnabled"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
              </div>

              {/* Vignette */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Vignette Intensity</Label>
                  <Controller
                    name="vignetteIntensity"
                    control={control}
                    render={({ field }) => (
                      <span className="text-sm text-muted-foreground tabular-nums w-10 text-right">
                        {(field.value ?? 0).toFixed(2)}
                      </span>
                    )}
                  />
                </div>
                <Controller
                  name="vignetteIntensity"
                  control={control}
                  render={({ field }) => (
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={[field.value ?? 0]}
                      onValueChange={([v]) => field.onChange(v)}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  0 = no vignette · 0.5 = medium depth (recommended) · 1 = heavy
                </p>
              </div>
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
