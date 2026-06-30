/**
 * Fan Page document schema v1 — responsive section-based landing pages.
 */

import { z } from 'zod'
import { imageCropSchema } from '@/lib/shared/imageCrop'

export const fanPageBlockTypeSchema = z.enum([
  'hero',
  'bio',
  'release_grid',
  'music_player',
  'tour_dates',
  'smart_links',
  'newsletter_signup',
  'gallery',
  'video_grid',
  'merch_shelf',
  'cta_banner',
  'spacer',
])

export type FanPageBlockType = z.infer<typeof fanPageBlockTypeSchema>

export const fanPagePublishStatusSchema = z.enum([
  'draft',
  'pending_review',
  'published',
  'rejected',
])

export type FanPagePublishStatus = z.infer<typeof fanPagePublishStatusSchema>

export const fanPageImagePropsSchema = z.object({
  src: z.string().url().optional(),
  alt: z.string().optional(),
  crop: imageCropSchema.optional(),
  focalX: z.number().min(0).max(100).optional(),
  focalY: z.number().min(0).max(100).optional(),
  scale: z.number().min(1).optional(),
  objectFit: z.enum(['contain', 'cover', 'fill']).optional(),
})

export type FanPageImageProps = z.infer<typeof fanPageImagePropsSchema>

export const fanPageSectionStylesSchema = z.object({
  paddingY: z.enum(['none', 'sm', 'md', 'lg']).optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
})

export type FanPageSectionStyles = z.infer<typeof fanPageSectionStylesSchema>

export const fanPageSectionSchema = z.object({
  id: z.string().min(1),
  type: fanPageBlockTypeSchema,
  order: z.number().int().min(0),
  props: z.record(z.string(), z.unknown()).default({}),
  styles: z
    .object({
      desktop: fanPageSectionStylesSchema.default({}),
      mobile: fanPageSectionStylesSchema.optional(),
    })
    .default({ desktop: {} }),
  hiddenOn: z.array(z.enum(['desktop', 'mobile'])).optional(),
})

export type FanPageSection = z.infer<typeof fanPageSectionSchema>

export const fanPageThemeSchema = z.object({
  paletteId: z.string().default('dark-minimal'),
  customColors: z
    .object({
      primary: z.string().optional(),
      accent: z.string().optional(),
      background: z.string().optional(),
    })
    .optional(),
  crtScanlines: z.boolean().optional(),
})

export type FanPageTheme = z.infer<typeof fanPageThemeSchema>

export const landingPageDocumentV1Schema = z.object({
  version: z.literal(1),
  templateId: z.string(),
  theme: fanPageThemeSchema,
  sections: z.array(fanPageSectionSchema),
})

export type LandingPageDocumentV1 = z.infer<typeof landingPageDocumentV1Schema>

export function parseLandingPageDocumentV1(input: unknown): LandingPageDocumentV1 {
  return landingPageDocumentV1Schema.parse(input)
}

export function createSectionId(): string {
  return `sec_${crypto.randomUUID().slice(0, 8)}`
}