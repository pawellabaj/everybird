// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EbirdDrop } from '@/components/import/EbirdDrop'

const idle = { busy: false, rows: 0, error: null }
const note = () => screen.queryByTestId('ebird-detail')
afterEach(() => {
  cleanup()
  history.replaceState(null, '', '/')
})

describe('EbirdDrop: what each eBird file brings', () => {
  it('only the life list download: a visible note, and its button opens the MyEBirdData panel', () => {
    render(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 0, quick: 3 }} connected={[{ slot: 'ebird-list' }]} />)
    expect(screen.getByTestId('places-lifer-note')).toBeVisible()
    expect(screen.getByTestId('places-lifer-note')).toHaveTextContent('Your eBird life list only says where each bird was first seen, so Places filters by those first places. MyEBirdData has every place you saw each bird, down to the county.')
    expect(screen.getByTestId('places-lifer-add')).toHaveAccessibleName('Add MyEBirdData')
    expect(screen.queryByRole('group', { name: 'Add MyEBirdData' })).toBeNull()
    fireEvent.click(screen.getByTestId('places-lifer-add'))
    expect(screen.getByRole('group', { name: 'Add MyEBirdData' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose your eBird file' })).toHaveFocus()
    expect(note()).toBeNull()
  })
  it('#add-mydata opens the MyEBirdData panel on arrival', () => {
    history.replaceState(null, '', '#add-mydata')
    render(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 0, quick: 3 }} connected={[{ slot: 'ebird-list' }]} />)
    expect(screen.getByRole('group', { name: 'Add MyEBirdData' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose your eBird file' })).toHaveFocus()
  })
  it('#add-mydata later (a hashchange) opens it too; while a file is being read nothing happens', () => {
    const { rerender } = render(<EbirdDrop job={{ ...idle, busy: true }} onFile={() => {}} loaded={{ full: 0, quick: 3 }} connected={[{ slot: 'ebird-list' }]} />)
    history.replaceState(null, '', '#add-mydata')
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(screen.queryByRole('group', { name: 'Add MyEBirdData' })).toBeNull()
    rerender(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 0, quick: 3 }} connected={[{ slot: 'ebird-list' }]} />)
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(screen.getByRole('group', { name: 'Add MyEBirdData' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose your eBird file' })).toHaveFocus()
  })
  it('#add-mydata with MyEBirdData already on the list (saved before seen-here): focuses its Replace', () => {
    history.replaceState(null, '', '#add-mydata')
    render(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 3, quick: 0, fullCounty: false }} connected={[{ slot: 'ebird' }]} />)
    expect(screen.getByRole('button', { name: /^Replace/ })).toHaveFocus()
    expect(screen.queryByTestId('places-lifer-note')).toBeNull()
  })
  it('a full export: no lifer-only note', () => {
    render(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 3, quick: 3, fullCounty: true }} connected={[{ slot: 'ebird' }, { slot: 'ebird-list' }]} />)
    expect(screen.queryByTestId('places-lifer-note')).toBeNull()
  })
  it('a full-export slot with no county anywhere: one line suggesting to import "Download My Data" again', () => {
    render(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 3, quick: 0, fullCounty: false }} />)
    expect(note()).toHaveTextContent('No regions (counties) in your eBird file yet: import “Download My Data” again to add them.')
  })
  it('a full export with counties: no note at all', () => {
    render(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 3, quick: 0, fullCounty: true }} />)
    expect(note()).toBeNull()
  })
})
