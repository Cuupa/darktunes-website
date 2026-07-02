import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RichFaqContent } from '@/components/portal/RichFaqContent'

describe('RichFaqContent', () => {
  it('renders sanitized HTML content', () => {
    render(<RichFaqContent content="<p>Hello <strong>world</strong></p>" />)
    expect(screen.getByText('world')).toBeInTheDocument()
  })

  it('renders markdown paragraphs', () => {
    render(<RichFaqContent content="**Bold** answer line" />)
    expect(screen.getByText('Bold')).toBeInTheDocument()
  })

  it('strips script tags from HTML', () => {
    const { container } = render(
      <RichFaqContent content='<p>Safe</p><script>alert("xss")</script>' />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText('Safe')).toBeInTheDocument()
  })
})