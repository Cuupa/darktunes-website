import { z } from 'zod'
import { registerTool } from '@/lib/ai/tools/registry'
import { createActionConfirmation } from '@/lib/ai/actions/confirmations'
import { ApiError } from '@/lib/errors'

const previewOutput = z.object({
  needs_confirmation: z.literal(true),
  action: z.string(),
  confirmation_token: z.string(),
  expires_at: z.string(),
  summary: z.string(),
  payload: z.record(z.string(), z.unknown()),
})

function requireArtistId(artistId: string | null): string {
  if (!artistId) throw new ApiError(403, 'No artist linked to this account', 'FORBIDDEN_NO_ARTIST')
  return artistId
}

registerTool({
  name: 'prepare_epk_text',
  description: 'Prepare an EPK short bio update. Does not save until the user confirms.',
  input: z.object({ text: z.string().min(10).max(4000) }),
  output: previewOutput,
  capabilities: [],
  dataScope: 'self_artist',
  classification: 'write',
  maxResultBytes: 8000,
  timeoutMs: 5000,
  execute: async (input, context) => {
    requireArtistId(context.actor.artistId)
    const preview = await createActionConfirmation(context.actor.serviceDb, {
      actor: context.actor,
      action: 'save_epk_text',
      payload: { text: input.text },
      summary: 'Replace the EPK short bio with the prepared text.',
    })
    return { needs_confirmation: true as const, ...preview }
  },
})

registerTool({
  name: 'prepare_profile_update',
  description: 'Prepare a press-quote update. Does not save until the user confirms.',
  input: z.object({ press_quote: z.string().min(4).max(500) }),
  output: previewOutput,
  capabilities: [],
  dataScope: 'self_artist',
  classification: 'write',
  maxResultBytes: 4000,
  timeoutMs: 5000,
  execute: async (input, context) => {
    requireArtistId(context.actor.artistId)
    const preview = await createActionConfirmation(context.actor.serviceDb, {
      actor: context.actor,
      action: 'save_profile_update',
      payload: { press_quote: input.press_quote },
      summary: 'Update the press quote on the artist profile.',
    })
    return { needs_confirmation: true as const, ...preview }
  },
})

registerTool({
  name: 'prepare_release_draft',
  description: 'Prepare a release submission wizard draft. Does not submit until the user confirms.',
  input: z.object({
    title: z.string().min(1).max(200),
    notes: z.string().max(2000).optional(),
  }),
  output: previewOutput,
  capabilities: [],
  dataScope: 'self_artist',
  classification: 'write',
  maxResultBytes: 4000,
  timeoutMs: 5000,
  execute: async (input, context) => {
    requireArtistId(context.actor.artistId)
    const preview = await createActionConfirmation(context.actor.serviceDb, {
      actor: context.actor,
      action: 'save_release_draft',
      payload: { title: input.title, notes: input.notes ?? '' },
      summary: `Save a release wizard draft titled “${input.title}”.`,
    })
    return { needs_confirmation: true as const, ...preview }
  },
})

registerTool({
  name: 'prepare_support_ticket',
  description: 'Prepare a support ticket. Does not send until the user confirms.',
  input: z.object({
    subject: z.string().min(4).max(200),
    message: z.string().min(10).max(4000),
  }),
  output: previewOutput,
  capabilities: [],
  dataScope: 'none',
  classification: 'write',
  maxResultBytes: 6000,
  timeoutMs: 5000,
  execute: async (input, context) => {
    const preview = await createActionConfirmation(context.actor.serviceDb, {
      actor: context.actor,
      action: 'create_support_ticket',
      payload: { subject: input.subject, message: input.message },
      summary: `Create a support ticket: ${input.subject}`,
    })
    return { needs_confirmation: true as const, ...preview }
  },
})

registerTool({
  name: 'prepare_error_report',
  description: 'Prepare a structured error report. Does not store until the user confirms.',
  input: z.object({
    description: z.string().min(10).max(4000),
    error_reference: z.string().max(80).optional(),
    fingerprint: z.string().max(200).optional(),
  }),
  output: previewOutput,
  capabilities: [],
  dataScope: 'none',
  classification: 'write',
  maxResultBytes: 6000,
  timeoutMs: 5000,
  execute: async (input, context) => {
    const preview = await createActionConfirmation(context.actor.serviceDb, {
      actor: context.actor,
      action: 'save_error_report',
      payload: {
        description: input.description,
        error_reference: input.error_reference ?? '',
        fingerprint: input.fingerprint ?? '',
      },
      summary: 'Save an error report for the label team.',
    })
    return { needs_confirmation: true as const, ...preview }
  },
})
