import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageChatThread } from './MessageChatThread'

describe('MessageChatThread', () => {
  it('renders messages in chronological order as a chat log', () => {
    render(
      <MessageChatThread
        items={[
          {
            id: '2',
            body: 'Second',
            sentAt: '2026-08-07T12:00:00.000Z',
            isOwn: true,
            senderLabel: 'You',
          },
          {
            id: '1',
            body: 'First',
            sentAt: '2026-08-07T11:00:00.000Z',
            isOwn: false,
            senderLabel: 'Label',
          },
        ]}
      />,
    )

    const log = screen.getByRole('log', { name: 'Conversation' })
    expect(log).toBeInTheDocument()
    const articles = screen.getAllByRole('article')
    expect(articles).toHaveLength(2)
    expect(articles[0]).toHaveTextContent('First')
    expect(articles[0]).toHaveTextContent('Label')
    expect(articles[1]).toHaveTextContent('Second')
    expect(articles[1]).toHaveTextContent('You')
  })
})
