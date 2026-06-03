import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MessagesManager } from './MessagesManager'

const {
  mockToastError,
  mockGetArtists,
  mockGetMessageTemplates,
  mockGetAllLabelMessages,
  mockSearchLabelMessages,
  mockGetRepliesForMessage,
  mockSetSession,
  mockSupabase,
} = vi.hoisted(() => {
  const mockToastError = vi.fn()
  const mockGetArtists = vi.fn()
  const mockGetMessageTemplates = vi.fn()
  const mockGetAllLabelMessages = vi.fn()
  const mockSearchLabelMessages = vi.fn()
  const mockGetRepliesForMessage = vi.fn()
  const mockSendMessage = vi.fn()
  const mockSoftDeleteMessage = vi.fn()
  const mockStarMessage = vi.fn()
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }
  const mockSetSession = vi.fn().mockResolvedValue({ error: null })
  const mockSupabase = {
    auth: { setSession: mockSetSession },
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn().mockResolvedValue(undefined),
  }

  return {
    mockToastError,
    mockGetArtists,
    mockGetMessageTemplates,
    mockGetAllLabelMessages,
    mockSearchLabelMessages,
    mockGetRepliesForMessage,
    mockSetSession,
    mockSupabase,
    mockSendMessage,
    mockSoftDeleteMessage,
    mockStarMessage,
  }
})

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: vi.fn(),
  },
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    loading: false,
    session: {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    },
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => mockSupabase,
}))

vi.mock('@/lib/api/artists', () => ({
  getArtists: mockGetArtists,
}))

vi.mock('@/lib/api/artistReplies', () => ({
  getRepliesForMessage: mockGetRepliesForMessage,
}))

vi.mock('@/lib/api/labelMessages', () => ({
  getAllLabelMessages: mockGetAllLabelMessages,
  getMessageTemplates: mockGetMessageTemplates,
  searchLabelMessages: mockSearchLabelMessages,
  sendMessage: vi.fn(),
  softDeleteMessage: vi.fn(),
  starMessage: vi.fn(),
}))

vi.mock('@/components/messaging/MessageComposer', () => ({
  MessageComposer: ({
    artists,
    isArtistsLoading,
    artistLoadError,
  }: {
    artists: Array<{ id: string; name: string }>
    isArtistsLoading?: boolean
    artistLoadError?: string | null
  }) => (
    <div data-testid="composer">
      {isArtistsLoading ? 'loading' : ((artistLoadError ?? artists.map((artist) => artist.name).join(',')) || 'empty')}
    </div>
  ),
}))

vi.mock('@/components/messaging/MessageSearch', () => ({
  MessageSearch: () => <div data-testid="search" />,
}))

vi.mock('@/components/messaging/ThreadView', () => ({
  ThreadView: () => <div data-testid="thread-view" />,
}))

describe('MessagesManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetSession.mockResolvedValue({ error: null })
    mockGetArtists.mockResolvedValue([])
    mockGetMessageTemplates.mockResolvedValue([])
    mockGetAllLabelMessages.mockResolvedValue([])
    mockSearchLabelMessages.mockResolvedValue([])
    mockGetRepliesForMessage.mockResolvedValue([])
  })

  it('syncs the authenticated session into the local client before loading artists', async () => {
    mockGetArtists.mockResolvedValue([
      { id: 'artist-1', name: 'Artist One' },
      { id: 'artist-2', name: 'Artist Two' },
    ])

    render(<MessagesManager />)

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      })
    })
    await waitFor(() => expect(screen.getByTestId('composer')).toHaveTextContent('Artist One,Artist Two'))
  })

  it('still passes artists to the composer when templates fail to load', async () => {
    mockGetArtists.mockResolvedValue([{ id: 'artist-1', name: 'Artist One' }])
    mockGetMessageTemplates.mockRejectedValue(new Error('Templates unavailable'))

    render(<MessagesManager />)

    await waitFor(() => expect(screen.getByTestId('composer')).toHaveTextContent('Artist One'))
    expect(mockToastError).toHaveBeenCalledWith('Templates unavailable')
  })
})
