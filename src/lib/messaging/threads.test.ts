import { describe, expect, it } from 'vitest'
import {
  groupLabelMessagesIntoThreads,
  groupPortalMessagesIntoThreads,
  normalizeSubject,
  sortConversationThreads,
} from './threads'

describe('normalizeSubject', () => {
  it('strips stacked Re:/Aw: prefixes', () => {
    expect(normalizeSubject('Re: Re: Hello')).toBe('Hello')
    expect(normalizeSubject('AW: Betrifft Statement')).toBe('Betrifft Statement')
    expect(normalizeSubject('Fwd: Cover')).toBe('Cover')
  })
})

describe('groupPortalMessagesIntoThreads', () => {
  const viewer = 'artist-a'
  const peer = 'artist-b'

  it('collapses Re: correspondence into one thread', () => {
    const threads = groupPortalMessagesIntoThreads(
      [
        {
          id: '1',
          fromArtistId: peer,
          toArtistId: viewer,
          toLabel: false,
          subject: 'Tour dates',
          body: 'Hi',
          sentAt: '2026-01-01T10:00:00Z',
          readAt: null,
          starred: false,
          deletedAt: null,
          folderId: null,
          fromArtistName: 'Peer',
        },
        {
          id: '2',
          fromArtistId: viewer,
          toArtistId: peer,
          toLabel: false,
          subject: 'Re: Tour dates',
          body: 'Sure',
          sentAt: '2026-01-01T11:00:00Z',
          readAt: '2026-01-01T11:00:00Z',
          starred: false,
          deletedAt: null,
          folderId: null,
        },
        {
          id: '3',
          fromArtistId: peer,
          toArtistId: viewer,
          toLabel: false,
          subject: 'Re: Tour dates',
          body: 'Thanks',
          sentAt: '2026-01-01T12:00:00Z',
          readAt: null,
          starred: true,
          deletedAt: null,
          folderId: null,
          fromArtistName: 'Peer',
        },
      ],
      viewer,
      { forInbox: true },
    )

    expect(threads).toHaveLength(1)
    expect(threads[0]!.messageCount).toBe(3)
    expect(threads[0]!.subject).toBe('Tour dates')
    expect(threads[0]!.unread).toBe(true)
    expect(threads[0]!.starred).toBe(true)
    expect(threads[0]!.preview).toBe('Thanks')
    expect(threads[0]!.messages.map((m) => m.id)).toEqual(['1', '2', '3'])
  })

  it('hides sent-only threads from inbox mode', () => {
    const threads = groupPortalMessagesIntoThreads(
      [
        {
          id: 's1',
          fromArtistId: viewer,
          toArtistId: peer,
          toLabel: false,
          subject: 'Only sent',
          body: 'x',
          sentAt: '2026-01-01T10:00:00Z',
          readAt: null,
          starred: false,
          deletedAt: null,
          folderId: null,
        },
      ],
      viewer,
      { forInbox: true },
    )
    expect(threads).toHaveLength(0)
  })
})

describe('groupLabelMessagesIntoThreads', () => {
  it('groups label messages by artist + subject', () => {
    const threads = groupLabelMessagesIntoThreads([
      {
        id: 'l1',
        artistId: 'a1',
        subject: 'Promo',
        body: 'First',
        sentAt: '2026-01-01T10:00:00Z',
        read: true,
        starred: false,
        deletedAt: null,
        folderId: null,
      },
      {
        id: 'l2',
        artistId: 'a1',
        subject: 'Re: Promo',
        body: 'Follow-up',
        sentAt: '2026-01-02T10:00:00Z',
        read: false,
        starred: false,
        deletedAt: null,
        folderId: null,
      },
    ])
    expect(threads).toHaveLength(1)
    expect(threads[0]!.messageCount).toBe(2)
    expect(threads[0]!.unread).toBe(true)
    expect(threads[0]!.rootMessageId).toBe('l1')
  })
})

describe('sortConversationThreads', () => {
  const base = groupPortalMessagesIntoThreads(
    [
      {
        id: '1',
        fromArtistId: 'b',
        toArtistId: 'a',
        toLabel: false,
        subject: 'Zulu',
        body: 'z',
        sentAt: '2026-01-02T00:00:00Z',
        readAt: 'x',
        starred: false,
        deletedAt: null,
        folderId: null,
      },
      {
        id: '2',
        fromArtistId: 'b',
        toArtistId: 'a',
        toLabel: false,
        subject: 'Alpha',
        body: 'a',
        sentAt: '2026-01-01T00:00:00Z',
        readAt: null,
        starred: false,
        deletedAt: null,
        folderId: null,
      },
    ],
    'a',
    { forInbox: true },
  )

  it('sorts by subject', () => {
    const sorted = sortConversationThreads(base, 'subject_asc')
    expect(sorted.map((t) => t.subject)).toEqual(['Alpha', 'Zulu'])
  })

  it('puts unread first', () => {
    const sorted = sortConversationThreads(base, 'unread_first')
    expect(sorted[0]!.unread).toBe(true)
    expect(sorted[0]!.subject).toBe('Alpha')
  })
})
