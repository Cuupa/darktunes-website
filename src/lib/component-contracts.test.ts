import { describe, it, expect } from 'vitest'
import type { SectionProps, EditableSectionProps, AdminPanelProps, DialogProps, SectionLabels } from '@/lib/component-contracts'

describe('component-contracts', () => {
  it('SectionProps is optional everywhere', () => {
    const props: SectionProps = {}
    expect(props.editMode).toBeUndefined()
    expect(props.sectionLabels).toBeUndefined()
    expect(props.onLabelChange).toBeUndefined()
  })

  it('SectionProps accepts editMode, sectionLabels, onLabelChange', () => {
    const labels: SectionLabels = { headline: 'New Releases' }
    const props: SectionProps = {
      editMode: true,
      sectionLabels: labels,
      onLabelChange: (key, value) => { void key; void value },
    }
    expect(props.editMode).toBe(true)
    expect(props.sectionLabels?.headline).toBe('New Releases')
  })

  it('EditableSectionProps carries typed data alongside SectionProps', () => {
    interface TestData { title: string }
    const props: EditableSectionProps<TestData> = {
      data: { title: 'Polymorph' },
      editMode: false,
    }
    expect(props.data.title).toBe('Polymorph')
  })

  it('AdminPanelProps carries value, onChange and optional isLoading', () => {
    interface ArtistSlice { name: string }
    let updated: ArtistSlice | null = null
    const props: AdminPanelProps<ArtistSlice> = {
      value: { name: 'C Z A R I N A' },
      onChange: (v) => { updated = v },
      isLoading: false,
    }
    props.onChange({ name: 'BLACKBOOK' })
    expect(updated).toEqual({ name: 'BLACKBOOK' })
  })

  it('DialogProps requires open and onClose', () => {
    let closed = false
    const props: DialogProps = {
      open: true,
      onClose: () => { closed = true },
    }
    props.onClose()
    expect(closed).toBe(true)
  })
})
