import { z } from 'zod'
import { registerTool } from '@/lib/ai/tools/registry'
import { getArtistById } from '@/lib/api/artists'
import { getArtistProfileByArtistId } from '@/lib/api/artistProfiles'
import { getReleasesByArtistId } from '@/lib/api/releases'
import { getReleaseSubmissionsByArtistId } from '@/lib/api/releaseSubmissions'
import { searchHelpContent } from '@/lib/portal/useHelpSearch'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { ApiError } from '@/lib/errors'

function requireArtistId(artistId: string | null): string {
  if (!artistId) throw new ApiError(403, 'No artist linked to this account', 'FORBIDDEN_NO_ARTIST')
  return artistId
}

registerTool({
  name: 'get_artist_profile',
  description: 'Get the current artist name, slug, and EPK completeness.',
  input: z.object({}),
  output: z.object({
    available: z.boolean(),
    name: z.string().optional(),
    slug: z.string().optional(),
    has_bio: z.boolean().optional(),
    has_photo: z.boolean().optional(),
    reason: z.string().optional(),
  }),
  capabilities: [],
  dataScope: 'self_artist',
  classification: 'read',
  maxResultBytes: 4000,
  timeoutMs: 8000,
  execute: async (_input, context) => {
    const artistId = requireArtistId(context.actor.artistId)
    const artist = await getArtistById(context.actor.serviceDb, artistId)
    if (!artist) return { available: false, reason: 'Artist not found.' }
    const profile = await getArtistProfileByArtistId(context.actor.serviceDb, artistId)
    return {
      available: true,
      name: artist.name,
      slug: artist.slug,
      has_bio: Boolean(profile?.bioShort || profile?.bioMedium || profile?.bioLong),
      has_photo: Boolean(artist.imageUrl),
    }
  },
})

registerTool({
  name: 'get_artist_releases',
  description: 'List the current artist catalog releases (title, year, type).',
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  output: z.object({
    available: z.boolean(),
    releases: z.array(z.object({ title: z.string(), release_date: z.string(), type: z.string() })),
    reason: z.string().optional(),
  }),
  capabilities: [],
  dataScope: 'self_artist',
  classification: 'read',
  maxResultBytes: 8000,
  timeoutMs: 8000,
  execute: async (input, context) => {
    const artistId = requireArtistId(context.actor.artistId)
    const releases = await getReleasesByArtistId(context.actor.serviceDb, artistId)
    const limit = input.limit ?? 10
    return {
      available: true,
      releases: releases.slice(0, limit).map((release) => ({
        title: release.title,
        release_date: release.releaseDate,
        type: release.type,
      })),
    }
  },
})

registerTool({
  name: 'get_release_submission_status',
  description: 'List pending and recent release submissions for the current artist.',
  input: z.object({}),
  output: z.object({
    available: z.boolean(),
    submissions: z.array(z.object({ title: z.string(), status: z.string(), created_at: z.string() })),
  }),
  capabilities: [],
  dataScope: 'self_artist',
  classification: 'read',
  maxResultBytes: 8000,
  timeoutMs: 8000,
  execute: async (_input, context) => {
    const artistId = requireArtistId(context.actor.artistId)
    const submissions = await getReleaseSubmissionsByArtistId(context.actor.serviceDb, artistId)
    return {
      available: true,
      submissions: submissions.slice(0, 15).map((item) => ({
        title: item.title,
        status: item.status,
        created_at: item.createdAt,
      })),
    }
  },
})

registerTool({
  name: 'search_portal_help',
  description: 'Search artist portal help topics for how-to questions.',
  input: z.object({ query: z.string().min(2).max(120) }),
  output: z.object({
    available: z.boolean(),
    matches: z.array(z.object({ kind: z.string(), topic_id: z.string().optional(), score: z.number() })),
  }),
  capabilities: [],
  dataScope: 'none',
  classification: 'read',
  maxResultBytes: 4000,
  timeoutMs: 3000,
  execute: async (input) => {
    const result = searchHelpContent(input.query, (key) => key)
    return {
      available: result.matches.length > 0,
      matches: result.matches.slice(0, 8).map((match) => ({
        kind: match.kind,
        topic_id: match.topicId,
        score: match.score,
      })),
    }
  },
})

registerTool({
  name: 'get_portal_feature_availability',
  description: 'Show which portal feature flags are enabled for artists.',
  input: z.object({}),
  output: z.object({ flags: z.record(z.string(), z.boolean()) }),
  capabilities: [],
  dataScope: 'self_artist',
  classification: 'read',
  maxResultBytes: 4000,
  timeoutMs: 5000,
  execute: async (_input, context) => {
    const flags = await getFeatureFlagsForRole(context.actor.serviceDb, 'artist')
    return { flags }
  },
})
