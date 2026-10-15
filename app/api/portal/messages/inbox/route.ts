/**
 * app/api/portal/messages/inbox/route.ts
 *
 * GET /api/portal/messages/inbox?artistId=<uuid>&folder=<id|system>
 * Auth: Bearer (preferred) or cookie session (dual-auth window).
 */

import { NextRequest, NextResponse } from 'next/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { getLabelMessages } from '@/lib/api/labelMessages'
import { getRepliesForMessages } from '@/lib/api/artistReplies'
import {
  getFromArtistMessages,
  getInboxMessages,
  getSentMessages,
  getStarredMessages,
  getTrashedMessages,
} from '@/lib/api/portalMessages'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'

const ROUTE = 'GET /api/portal/messages/inbox'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { searchParams } = new URL(req.url)
  const artistId = searchParams.get('artistId')
  const folder = searchParams.get('folder') ?? 'inbox'
  if (!artistId) throw new ApiError(400, 'artistId is required')

  const ctx = await withPortalMembershipWrite(req, artistId)

  const { value: payload } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'portal_messages', operation: 'select' },
    async (db) => {
      let messages
      if (folder === 'sent') {
        messages = await getSentMessages(db, artistId)
      } else if (folder === 'starred') {
        messages = await getStarredMessages(db, artistId)
      } else if (folder === 'trash') {
        messages = await getTrashedMessages(db, artistId)
      } else if (folder === 'inbox') {
        messages = await getInboxMessages(db, artistId)
      } else if (folder === 'from-artists') {
        messages = await getFromArtistMessages(db, artistId)
      } else {
        messages = await getInboxMessages(db, artistId, folder)
      }

      if (folder === 'inbox') {
        // Include sent so client can build full conversations (Re: threads)
        // without listing every reply as its own inbox row.
        const sent = await getSentMessages(db, artistId)
        const byId = new Map(messages.map((m) => [m.id, m]))
        for (const m of sent) byId.set(m.id, m)
        messages = Array.from(byId.values()).sort(
          (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
        )

        const labelMessages = await getLabelMessages(db, artistId)
        let labelReplies: Awaited<ReturnType<typeof getRepliesForMessages>> = {}
        try {
          labelReplies = await getRepliesForMessages(
            db,
            labelMessages.map((message) => message.id),
          )
        } catch {
          // Replies are best-effort; still return the mailbox without them.
        }
        return { messages, labelMessages, labelReplies }
      }

      return { messages }
    },
  )

  return NextResponse.json(payload)
})
