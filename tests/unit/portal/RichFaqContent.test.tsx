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

  it('renders bullet lists with clip-safe list-inside classes', () => {
    const { container } = render(
      <RichFaqContent content="<ul><li>First item</li><li>Second item</li></ul>" />,
    )
    expect(screen.getByText('First item')).toBeInTheDocument()
    expect(screen.getByText('Second item')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('[&_ul]:list-inside')
    expect(container.firstChild).toHaveClass('[&_li>p]:inline')
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })
})