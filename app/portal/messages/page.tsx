export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getLabelMessages } from '@/lib/api/labelMessages'
import { getRepliesForMessage } from '@/lib/api/artistReplies'
import { Skeleton } from '@/components/ui/skeleton'
import type { ArtistReply } from '@/types'
import { MessagesInbox } from './_components/MessagesInbox'

function MessagesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
  )
}

async function MessagesContent() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const artist = await getArtistByUserId(supabase, user.id).catch(() => null)
  if (!artist) return null

  const messages = await getLabelMessages(supabase, artist.id).catch(() => [])
  const repliesByMessageId: Record<string, ArtistReply[]> = {}

  const replyResults = await Promise.allSettled(
    messages.map((message) => getRepliesForMessage(supabase, message.id)),
  )

  replyResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      repliesByMessageId[messages[index].id] = result.value
    } else {
      console.error('[PortalMessagesPage] Failed to load replies for message', messages[index]?.id, result.reason)
    }
  })

  return <MessagesInbox dict={dict.portal} initialMessages={messages} initialRepliesByMessageId={repliesByMessageId} />
}

export default function PortalMessagesPage() {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <MessagesContent />
    </Suspense>
  )
}
