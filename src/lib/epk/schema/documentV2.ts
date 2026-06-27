/**
 * src/lib/epk/schema/documentV2.ts
 *
 * Zod schema and TypeScript types for the EPK Canvas document (version 2).
 * Shared by the Konva editor, migration layer, and PDF export pipeline.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const epkPageFormatSchema = z.enum(['a4', 'letter', 'square'])
export type EpkPageFormat = z.infer<typeof epkPageFormatSchema>

export const epkOrientationSchema = z.enum(['portrait', 'landscape'])
export type EpkOrientation = z.infer<typeof epkOrientationSchema>

export const epkElementTypeSchema = z.enum(['text', 'image', 'shape', 'logo', 'group'])
export type EpkElementType = z.infer<typeof epkElementTypeSchema>

export const epkBackgroundTypeSchema = z.enum(['color', 'image', 'gradient'])
export type EpkBackgroundType = z.infer<typeof epkBackgroundTypeSchema>

export const epkEditorModeSchema = z.enum(['legacy', 'canvas'])
export type EpkEditorMode = z.infer<typeof epkEditorModeSchema>

// ---------------------------------------------------------------------------
// Nested objects
// ---------------------------------------------------------------------------

export const epkGradientStopSchema = z.object({
  offset: z.number().min(0).max(1),
  color: z.string(),
})

export type EpkGradientStop = z.infer<typeof epkGradientStopSchema>

export const epkFillTypeSchema = z.enum(['solid', 'gradient'])
export type EpkFillType = z.infer<typeof epkFillTypeSchema>

export const epkElementStyleSchema = z.object({
  fill: z.string().optional(),
  fillType: epkFillTypeSchema.optional(),
  gradientStops: z.array(epkGradientStopSchema).optional(),
  gradientAngle: z.number().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().positive().optional(),
  fontWeight: z.union([z.number(), z.string()]).optional(),
  fontStyle: z.enum(['normal', 'italic', 'bold', 'bold italic']).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  lineHeight: z.number().positive().optional(),
  letterSpacing: z.number().optional(),
  cornerRadius: z.number().min(0).optional(),
  objectFit: z.enum(['contain', 'cover', 'fill']).optional(),
  shadowColor: z.string().optional(),
  shadowBlur: z.number().min(0).optional(),
  shadowOffsetX: z.number().optional(),
  shadowOffsetY: z.number().optional(),
})

export type EpkElementStyle = z.infer<typeof epkElementStyleSchema>

export const epkPageBackgroundSchema = z.object({
  type: epkBackgroundTypeSchema,
  color: z.string().optional(),
  src: z.string().url().optional(),
  opacity: z.number().min(0).max(1).optional(),
  gradientStops: z.array(epkGradientStopSchema).optional(),
  gradientAngle: z.number().optional(),
})

export type EpkPageBackground = z.infer<typeof epkPageBackgroundSchema>

export const epkPageSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  background: epkPageBackgroundSchema,
})

export type EpkPage = z.infer<typeof epkPageSchema>

export const epkImageCropSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
})

export type EpkImageCrop = z.infer<typeof epkImageCropSchema>

export const epkElementSchema = z.object({
  id: z.string().min(1),
  pageId: z.string().min(1),
  type: epkElementTypeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().default(0),
  zIndex: z.number().int(),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
  role: z.string().optional(),
  style: epkElementStyleSchema.default({}),
  content: z.string().optional(),
  src: z.string().optional(),
  crop: epkImageCropSchema.optional(),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  children: z.array(z.string()).optional(),
})

export type EpkElement = z.infer<typeof epkElementSchema>

export const epkFontSchema = z.object({
  id: z.string().min(1),
  family: z.string().min(1),
  src: z.string().url().optional(),
  r2Key: z.string().optional(),
})

export type EpkFont = z.infer<typeof epkFontSchema>

export const epkDocumentMetadataSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  subject: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  /** Built-in color palette id — used by applyPaletteToDocument(). */
  themePaletteId: z.string().optional(),
})

export type EpkDocumentMetadata = z.infer<typeof epkDocumentMetadataSchema>

// ---------------------------------------------------------------------------
// Root document
// ---------------------------------------------------------------------------

export const epkDocumentV2Schema = z.object({
  version: z.literal(2),
  pageFormat: epkPageFormatSchema,
  orientation: epkOrientationSchema,
  pages: z.array(epkPageSchema).min(1),
  elements: z.array(epkElementSchema),
  fonts: z.array(epkFontSchema).default([]),
  metadata: epkDocumentMetadataSchema.default({}),
})

export type EpkDocumentV2 = z.infer<typeof epkDocumentV2Schema>

export function parseEpkDocumentV2(data: unknown): EpkDocumentV2 {
  return epkDocumentV2Schema.parse(data)
}

export function safeParseEpkDocumentV2(data: unknown) {
  return epkDocumentV2Schema.safeParse(data)
}