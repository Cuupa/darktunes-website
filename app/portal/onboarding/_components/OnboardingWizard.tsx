'use client'

/**
 * app/portal/onboarding/_components/OnboardingWizard.tsx
 *
 * Guides new artists through 5 steps to complete their profile:
 *  1. Welcome
 *  2. Upload photo
 *  3. Write short bio
 *  4. Add social & streaming links
 *  5. Announce first release
 *
 * On each step the data is auto-saved via a Server Action.
 * The wizard completes by marking `onboarding_completed = true`.
 */

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, ArrowRight, ArrowLeft, CheckCircle, MusicNote } from '@phosphor-icons/react'
import { TiptapEditor } from '@/components/admin/TiptapEditor'
import type { Dictionary } from '@/i18n/types'
import { saveOnboardingStep, completeOnboarding, skipOnboarding } from '../_actions/onboarding'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { uploadArtistPhoto } from '@/lib/api/portalProfile'
import { compressImage, formatFileSize } from '@/lib/imageResizer'

/** Must match the server-side limit in /api/portal/upload-photo. */
const ONBOARDING_PHOTO_MAX_BYTES = 5 * 1024 * 1024

interface OnboardingWizardProps {
  dict: Dictionary['portal']
  artistId: string
}

type StepId = 'welcome' | 'photo' | 'bio' | 'links' | 'release'

const STEPS: StepId[] = ['welcome', 'photo', 'bio', 'links', 'release']

function StepIndicator({
  steps,
  currentStep,
  dict,
}: {
  steps: StepId[]
  currentStep: number
  dict: Dictionary['portal']
}) {
  const labels: Record<StepId, string> = {
    welcome: dict.onboarding_step_welcome,
    photo: dict.onboarding_step_photo,
    bio: dict.onboarding_step_bio,
    links: dict.onboarding_step_links,
    release: dict.onboarding_step_release,
  }
  return (
    <div className="space-y-3">
      <Progress
        value={((currentStep + 1) / steps.length) * 100}
        className="h-1.5"
        aria-label="Onboarding progress"
      />
      <div className="flex justify-between text-xs text-muted-foreground font-mono uppercase tracking-wider">
        {steps.map((step, i) => (
          <span key={step} className={i <= currentStep ? 'text-primary' : ''}>
            {labels[step]}
          </span>
        ))}
      </div>
    </div>
  )
}

export function OnboardingWizard({ dict, artistId }: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 2: Photo
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | undefined>()
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  // Step 3: Bio
  const [bioShort, setBioShort] = useState('')

  // Step 4: Links
  const [instagramUrl, setInstagramUrl] = useState('')
  const [spotifyUrl, setSpotifyUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  const isUploading = uploadProgress !== null && uploadProgress < 100

  const handlePhotoChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.files?.[0]
      if (!raw) return
      setUploadProgress(0)
      try {
        const supabase = createBrowserSupabaseClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Not authenticated')
        // Auto-compress to stay within the 5 MB portal upload limit
        const file = raw.size > ONBOARDING_PHOTO_MAX_BYTES
          ? await compressImage(raw, { maxSizeBytes: ONBOARDING_PHOTO_MAX_BYTES })
          : raw
        const url = await uploadArtistPhoto(artistId, file, session.access_token, (pct) =>
          setUploadProgress(pct),
        )
        setPhotoUrl(url)
        await saveOnboardingStep({ image_url: url })
      } catch (err) {
        toast.error(dict.profile_photoError)
        console.error(err)
      } finally {
        setUploadProgress(null)
      }
    },
    [artistId, dict.profile_photoError],
  )

  const handleNext = async () => {
    const currentStepId = STEPS[step]
    setSaving(true)
    try {
      if (currentStepId === 'bio' && bioShort) {
        const result = await saveOnboardingStep({ bio_short: bioShort })
        if (!result.ok) {
          toast.error(dict.onboarding_save_error)
          return
        }
      } else if (currentStepId === 'links') {
        const result = await saveOnboardingStep({
          instagram_url: instagramUrl || null,
          spotify_url: spotifyUrl || null,
          website_url: websiteUrl || null,
        })
        if (!result.ok) {
          toast.error(dict.onboarding_save_error)
          return
        }
      }
      if (step < STEPS.length - 1) {
        setStep((s) => s + 1)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      const result = await completeOnboarding()
      if (!result.ok) {
        toast.error(dict.onboarding_save_error)
        return
      }
      router.push('/portal')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    await skipOnboarding()
    router.push('/portal')
  }

  const currentStepId = STEPS[step]
  const isLastStep = step === STEPS.length - 1
  const isFirstStep = step === 0

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{dict.onboarding_title}</h1>
          <p className="text-muted-foreground">{dict.onboarding_subtitle}</p>
        </div>

        {/* Step indicator */}
        <StepIndicator steps={STEPS} currentStep={step} dict={dict} />

        {/* Step content */}
        <Card className="bg-card border-border">
          {/* ── Step 1: Welcome ─────────────────────────────────────────── */}
          {currentStepId === 'welcome' && (
            <>
              <CardHeader>
                <CardTitle>{dict.onboarding_title}</CardTitle>
                <CardDescription>{dict.onboarding_subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 py-2">
                  {([dict.onboarding_step_photo, dict.onboarding_step_bio, dict.onboarding_step_links] as string[]).map(
                    (label) => (
                      <div
                        key={label}
                        className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted text-center"
                      >
                        <CheckCircle size={24} className="text-primary" aria-hidden="true" />
                        <span className="text-xs font-medium">{label}</span>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step 2: Photo ────────────────────────────────────────────── */}
          {currentStepId === 'photo' && (
            <>
              <CardHeader>
                <CardTitle>{dict.onboarding_photo_heading}</CardTitle>
                <CardDescription>{dict.onboarding_photo_desc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-32 h-32 rounded-full overflow-hidden bg-muted border-2 border-dashed border-border flex items-center justify-center">
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt="Your profile photo"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Camera size={40} className="text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="gap-2"
                  >
                    <Camera size={16} aria-hidden="true" />
                    {isUploading ? `${uploadProgress}%` : dict.profile_photo_upload}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Max {formatFileSize(ONBOARDING_PHOTO_MAX_BYTES)} — larger images are compressed automatically
                  </p>
                  {photoUrl && (
                    <p className="text-sm text-green-500 flex items-center gap-1">
                      <CheckCircle size={14} aria-hidden="true" />
                      {dict.profile_photoUploaded}
                    </p>
                  )}
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step 3: Bio ──────────────────────────────────────────────── */}
          {currentStepId === 'bio' && (
            <>
              <CardHeader>
                <CardTitle>{dict.onboarding_bio_heading}</CardTitle>
                <CardDescription>{dict.onboarding_bio_desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <TiptapEditor
                  value={bioShort}
                  onChange={setBioShort}
                  placeholder={dict.profile_bio_short}
                />
              </CardContent>
            </>
          )}

          {/* ── Step 4: Links ────────────────────────────────────────────── */}
          {currentStepId === 'links' && (
            <>
              <CardHeader>
                <CardTitle>{dict.onboarding_links_heading}</CardTitle>
                <CardDescription>{dict.onboarding_links_desc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ob-instagram">{dict.profile_instagram}</Label>
                  <Input
                    id="ob-instagram"
                    type="url"
                    placeholder="https://instagram.com/…"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    className="bg-muted border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-spotify">{dict.profile_spotify}</Label>
                  <Input
                    id="ob-spotify"
                    type="url"
                    placeholder="https://open.spotify.com/artist/…"
                    value={spotifyUrl}
                    onChange={(e) => setSpotifyUrl(e.target.value)}
                    className="bg-muted border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-website">{dict.profile_website}</Label>
                  <Input
                    id="ob-website"
                    type="url"
                    placeholder="https://…"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="bg-muted border-border"
                  />
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step 5: Release ──────────────────────────────────────────── */}
          {currentStepId === 'release' && (
            <>
              <CardHeader>
                <CardTitle>{dict.onboarding_release_heading}</CardTitle>
                <CardDescription>{dict.onboarding_release_desc}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 py-4">
                <MusicNote size={48} className="text-primary" aria-hidden="true" />
                <Button
                  type="button"
                  variant="default"
                  className="gap-2"
                  onClick={() => {
                    void completeOnboarding().then(() => router.push('/portal/releases/new'))
                  }}
                >
                  {dict.onboarding_release_cta}
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </CardContent>
            </>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div>
            {!isFirstStep && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => s - 1)}
                disabled={saving}
                className="gap-1.5"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {dict.onboarding_back}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              {dict.onboarding_skip}
            </Button>

            {isLastStep ? (
              <Button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="gap-1.5"
              >
                <CheckCircle size={16} aria-hidden="true" />
                {dict.onboarding_finish}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                disabled={saving || isUploading}
                className="gap-1.5"
              >
                {dict.onboarding_next}
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
