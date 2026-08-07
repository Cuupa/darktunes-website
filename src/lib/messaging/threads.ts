/**
 * Conversation threading for mailbox UIs.
 * Groups repeated Re:/Aw: correspondence into one inbox row without a DB thread_id.
 */

export type MailboxSortMode =
  | 'date_desc'
  | 'date_asc'
  | 'subject_asc'
  | 'unread_first'
  | 'count_desc'

const REPLY_PREFIX =
  /^(?:(?:re|aw|wg|fwd|fw|sv|vs|rif|antw)\s*:\s*)+/i

/** Strip reply/forward prefixes for grouping and display. */
export function normalizeSubject(subject: string): string {
  const trimmed = subject.trim()
  if (!trimmed) return '(no subject)'
  const stripped = trimmed.replace(REPLY_PREFIX, '').trim()
  return stripped || '(no subject)'
}

/** Stable pair key for two artist ids (order-independent). */
export function participantPairKey(a: string, b: string | null | undefined): string {
  if (!b) return `solo:${a}`
  return [a, b].sort().join('|')
}

export type ThreadablePortalMessage = {
  id: string
  fromArtistId: string
  toArtistId: string | null
  toLabel: boolean
  subject: string
  body: string
  bodyHtml?: string | null
  sentAt: string
  readAt?: string | null
  starred?: boolean
  deletedAt?: string | null
  folderId?: string | null
  fromArtistName?: string
  toArtistName?: string
}

export type ThreadableLabelMessage = {
  id: string
  artistId: string
  subject: string
  body: string
  bodyHtml?: string | null
  sentAt: string
  read: boolean
  starred?: boolean
  deletedAt?: string | null
  folderId?: string | null
}

export type PortalConversationThread = {
  kind: 'portal'
  /** Stable key used as list selection id */
  threadId: string
  subject: string
  latestAt: string
  preview: string
  unread: boolean
  starred: boolean
  messageCount: number
  folderId: string | null
  messages: ThreadablePortalMessage[]
  participantsLabel: string
}

export type LabelConversationThread = {
  kind: 'label'
  threadId: string
  subject: string
  latestAt: string
  preview: string
  unread: boolean
  starred: boolean
  messageCount: number
  folderId: string | null
  messages: ThreadableLabelMessage[]
  participantsLabel: string
  /** Primary label message id (oldest or first) for replies API */
  rootMessageId: string
}

export type ConversationThread = PortalConversationThread | LabelConversationThread

function portalThreadKey(msg: ThreadablePortalMessage, viewerArtistId: string): string {
  const subj = normalizeSubject(msg.subject).toLowerCase()
  if (msg.toLabel) {
    return `portal:label:${viewerArtistId}:${subj}`
  }
  const other =
    msg.fromArtistId === viewerArtistId ? msg.toArtistId : msg.fromArtistId
  const pair = participantPairKey(viewerArtistId, other)
  return `portal:${pair}:${subj}`
}

function labelThreadKey(msg: ThreadableLabelMessage): string {
  const subj = normalizeSubject(msg.subject).toLowerCase()
  return `label:${msg.artistId}:${subj}`
}

function portalParticipantsLabel(
  messages: ThreadablePortalMessage[],
  viewerArtistId: string,
): string {
  const sample = messages[0]
  if (!sample) return ''
  if (sample.toLabel || messages.some((m) => m.toLabel)) return 'Label'
  const other = messages.find((m) => m.fromArtistId !== viewerArtistId)
  if (other?.fromArtistName) return other.fromArtistName
  const outbound = messages.find((m) => m.fromArtistId === viewerArtistId && m.toArtistId)
  if (outbound?.toArtistName) return outbound.toArtistName
  if (other) return other.fromArtistId.slice(0, 8)
  return 'Artist'
}

/**
 * Group portal messages into conversations.
 * @param forInbox when true, only threads that include at least one *received* message for the viewer.
 */
export function groupPortalMessagesIntoThreads(
  messages: ThreadablePortalMessage[],
  viewerArtistId: string,
  options?: { forInbox?: boolean },
): PortalConversationThread[] {
  const map = new Map<string, ThreadablePortalMessage[]>()
  for (const msg of messages) {
    if (msg.deletedAt && options?.forInbox) continue
    const key = portalThreadKey(msg, viewerArtistId)
    const list = map.get(key) ?? []
    list.push(msg)
    map.set(key, list)
  }

  const threads: PortalConversationThread[] = []
  for (const [threadId, list] of map) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    )
    const received = sorted.filter((m) => m.toArtistId === viewerArtistId)
    if (options?.forInbox && received.length === 0) continue

    const latest = sorted[sorted.length - 1]!
    const folderId =
      sorted.find((m) => m.toArtistId === viewerArtistId)?.folderId ??
      latest.folderId ??
      null

    threads.push({
      kind: 'portal',
      threadId,
      subject: normalizeSubject(latest.subject),
      latestAt: latest.sentAt,
      preview: latest.body.slice(0, 120),
      unread: received.some((m) => !m.readAt),
      starred: sorted.some((m) => !!m.starred),
      messageCount: sorted.length,
      folderId,
      messages: sorted,
      participantsLabel: portalParticipantsLabel(sorted, viewerArtistId),
    })
  }

  return threads
}

/**
 * Group artist→label portal messages (admin "From Artists" queue)
 * by sender artist + normalized subject.
 */
export function groupPortalToLabelIntoThreads(
  messages: ThreadablePortalMessage[],
): PortalConversationThread[] {
  const map = new Map<string, ThreadablePortalMessage[]>()
  for (const msg of messages) {
    if (msg.deletedAt) continue
    const subj = normalizeSubject(msg.subject).toLowerCase()
    const key = `portal-to-label:${msg.fromArtistId}:${subj}`
    const list = map.get(key) ?? []
    list.push(msg)
    map.set(key, list)
  }

  const threads: PortalConversationThread[] = []
  for (const [threadId, list] of map) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    )
    const latest = sorted[sorted.length - 1]!
    threads.push({
      kind: 'portal',
      threadId,
      subject: normalizeSubject(latest.subject),
      latestAt: latest.sentAt,
      preview: latest.body.slice(0, 120),
      unread: sorted.some((m) => !m.readAt),
      starred: sorted.some((m) => !!m.starred),
      messageCount: sorted.length,
      folderId: latest.folderId ?? null,
      messages: sorted,
      participantsLabel: latest.fromArtistName ?? latest.fromArtistId.slice(0, 8),
    })
  }
  return threads
}

/** Group label→artist messages (same artist + subject) into one conversation row. */
export function groupLabelMessagesIntoThreads(
  messages: ThreadableLabelMessage[],
  participantsLabel = 'Label',
): LabelConversationThread[] {
  const map = new Map<string, ThreadableLabelMessage[]>()
  for (const msg of messages) {
    if (msg.deletedAt) continue
    const key = labelThreadKey(msg)
    const list = map.get(key) ?? []
    list.push(msg)
    map.set(key, list)
  }

  const threads: LabelConversationThread[] = []
  for (const [threadId, list] of map) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    )
    const latest = sorted[sorted.length - 1]!
    const root = sorted[0]!
    threads.push({
      kind: 'label',
      threadId,
      subject: normalizeSubject(latest.subject),
      latestAt: latest.sentAt,
      preview: latest.body.slice(0, 120),
      unread: sorted.some((m) => !m.read),
      starred: sorted.some((m) => !!m.starred),
      messageCount: sorted.length,
      folderId: root.folderId ?? null,
      messages: sorted,
      participantsLabel,
      rootMessageId: root.id,
    })
  }
  return threads
}

export function sortConversationThreads<T extends ConversationThread>(
  threads: T[],
  mode: MailboxSortMode,
): T[] {
  const copy = [...threads]
  switch (mode) {
    case 'date_asc':
      return copy.sort((a, b) => new Date(a.latestAt).getTime() - new Date(b.latestAt).getTime())
    case 'subject_asc':
      return copy.sort((a, b) => a.subject.localeCompare(b.subject, undefined, { sensitivity: 'base' }))
    case 'unread_first':
      return copy.sort((a, b) => {
        if (a.unread !== b.unread) return a.unread ? -1 : 1
        return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
      })
    case 'count_desc':
      return copy.sort((a, b) => {
        if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount
        return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
      })
    case 'date_desc':
    default:
      return copy.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
  }
}
