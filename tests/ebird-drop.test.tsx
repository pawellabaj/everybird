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
    // Its own name beside the row's "Add MyEBirdData", starting with the words it shows; it controls the row's panel.
    expect(screen.getByTestId('places-lifer-add')).toHaveTextContent('Add MyEBirdData')
    expect(screen.getByTestId('places-lifer-add')).toHaveAccessibleName('Add MyEBirdData for every place')
    expect(screen.queryByRole('group', { name: 'Add MyEBirdData' })).toBeNull()
    const panelId = screen.getByTestId('places-lifer-add').getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add MyEBirdData' })).toHaveAttribute('aria-controls', panelId)
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
  it('#add-mydata later (a hashchange) opens it too', () => {
    render(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 0, quick: 3 }} connected={[{ slot: 'ebird-list' }]} />)
    history.replaceState(null, '', '#add-mydata')
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(screen.getByRole('group', { name: 'Add MyEBirdData' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose your eBird file' })).toHaveFocus()
  })
  it('#add-mydata while a file is being read waits, and opens the panel once the read is done', () => {
    const { rerender } = render(<EbirdDrop job={{ ...idle, busy: true }} onFile={() => {}} loaded={{ full: 0, quick: 3 }} connected={[{ slot: 'ebird-list' }]} />)
    history.replaceState(null, '', '#add-mydata')
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(screen.queryByRole('group', { name: 'Add MyEBirdData' })).toBeNull()
    rerender(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 0, quick: 3 }} connected={[{ slot: 'ebird-list' }]} />)
    expect(screen.getByRole('group', { name: 'Add MyEBirdData' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose your eBird file' })).toHaveFocus()
    // Taken up once: a later read finishing doesn't move focus again.
    screen.getByRole('button', { name: /^Replace/ }).focus()
    rerender(<EbirdDrop job={{ ...idle, busy: true }} onFile={() => {}} loaded={{ full: 0, quick: 3 }} connected={[{ slot: 'ebird-list' }]} />)
    rerender(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 0, quick: 3 }} connected={[{ slot: 'ebird-list' }]} />)
    expect(screen.getByRole('button', { name: /^Replace/ })).toHaveFocus()
  })
  it('#add-mydata during a read that lands a file: the panel opens once the file is in; MyEBirdData landing focuses its Replace', () => {
    const { rerender } = render(<EbirdDrop job={{ ...idle, busy: true }} onFile={() => {}} loaded={{ full: 0, quick: 0 }} />)
    history.replaceState(null, '', '#add-mydata')
    fireEvent(window, new HashChangeEvent('hashchange'))
    // The life list download lands and the read ends in one render (use-import-jobs batches them).
    rerender(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 0, quick: 3 }} connected={[{ slot: 'ebird-list' }]} />)
    expect(screen.getByRole('group', { name: 'Add MyEBirdData' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose your eBird file' })).toHaveFocus()
    cleanup()
    const second = render(<EbirdDrop job={{ ...idle, busy: true }} onFile={() => {}} loaded={{ full: 0, quick: 0 }} />)
    fireEvent(window, new HashChangeEvent('hashchange'))
    second.rerender(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 3, quick: 0 }} connected={[{ slot: 'ebird' }]} />)
    expect(screen.getByRole('button', { name: /^Replace/ })).toHaveFocus()
  })
  it('#add-mydata during a read, then another anchor: nothing moves when the read ends', () => {
    const { rerender } = render(<EbirdDrop job={{ ...idle, busy: true }} onFile={() => {}} loaded={{ full: 0, quick: 3 }} connected={[{ slot: 'ebird-list' }]} />)
    history.replaceState(null, '', '#add-mydata')
    fireEvent(window, new HashChangeEvent('hashchange'))
    history.replaceState(null, '', '#match')
    rerender(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 0, quick: 3 }} connected={[{ slot: 'ebird-list' }]} />)
    expect(screen.queryByRole('group', { name: 'Add MyEBirdData' })).toBeNull()
  })
  it('#add-mydata with MyEBirdData already on the list (saved before seen-here): focuses its Replace, the reason beside it', () => {
    history.replaceState(null, '', '#add-mydata')
    render(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 3, quick: 0 }} placesNote="reimport" connected={[{ slot: 'ebird' }]} />)
    expect(screen.getByRole('button', { name: /^Replace/ })).toHaveFocus()
    expect(note()).toBeVisible()
    expect(screen.queryByTestId('places-lifer-note')).toBeNull()
  })
  it('a full export: no lifer-only note', () => {
    render(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 3, quick: 3 }} connected={[{ slot: 'ebird' }, { slot: 'ebird-list' }]} />)
    expect(screen.queryByTestId('places-lifer-note')).toBeNull()
  })
  it("the Places panel's reimport note: the same words here, Import MyEBirdData again", () => {
    render(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 3, quick: 0 }} placesNote="reimport" connected={[{ slot: 'ebird' }]} />)
    expect(note()).toHaveTextContent(/^Places only knows where each bird was first seen\. Import MyEBirdData again to filter by every place you saw each bird\.$/)
  })
  it('no reimport note otherwise, counties or not', () => {
    render(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 3, quick: 0 }} connected={[{ slot: 'ebird' }]} />)
    expect(note()).toBeNull()
    cleanup()
    render(<EbirdDrop job={idle} onFile={() => {}} loaded={{ full: 0, quick: 3 }} placesNote="add" connected={[{ slot: 'ebird-list' }]} />)
    expect(note()).toBeNull()
  })
})
