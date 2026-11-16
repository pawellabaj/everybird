// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useReducer, useState } from 'react'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import type { Regions, SpeciesRow } from '@/lib/species/types'
import type { PlacesUnplaced } from '@/lib/list/filter-summary'

// The one pass over the list that counts every place level, watched: a checkbox must not count the list again.
vi.mock('@/lib/list/filters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/list/filters')>()
  return { ...actual, placeCounts: vi.fn(actual.placeCounts) }
})

const { FilterDropdowns, SEARCH_FROM } = await import('@/components/filters/FilterDropdowns')
const { initialState, makeReducer } = await import('@/lib/list/store')
const { emptySaved } = await import('@/lib/list/storage')
const { buildSpeciesIndex } = await import('@/lib/species/load')
const { monthBins } = await import('@/lib/list/timeline')
const { placeCounts } = await import('@/lib/list/filters')
const counted = vi.mocked(placeCounts)
type Panel = import('@/components/filters/FilterDropdowns').Panel
type PlacesNote = import('@/components/filters/FilterDropdowns').PlacesNote

const row = (code: string, ord: string, fam: string, to: number): SpeciesRow => ({
  code, com: code, sci: `Avis ${code}`, ord, fam, famCom: fam, to, g: 100, gSrc: 'avonet', st: true, ar: 1, q: true,
})
const species = buildSpeciesIndex([row('duck1', 'Anseriformes', 'Anatidae', 1), row('crow1', 'Passeriformes', 'Corvidae', 3), row('owl1', 'Strigiformes', 'Strigidae', 5)])
const MORE = { FR: 'France', DE: 'Germany', JP: 'Japan', KE: 'Kenya', PE: 'Peru', MX: 'Mexico', AU: 'Australia' }
const regions: Regions = { v: 1, countries: { CA: 'Canada', EG: 'Egypt', US: 'United States of America', ...MORE }, sub1: { 'CA-BC': 'British Columbia', 'CA-ON': 'Ontario', 'US-WA': 'Washington' } }
const name = (c: string) => regions.countries[c] ?? c

type Variant = 'full' | 'lifer' | 'countries' | 'many'

// full: duck1 lifer in Canada, also seen in the US (Capital, British Columbia and King, Washington); crow1 lifer in
// Egypt, also seen in British Columbia; owl1 Ontario only. lifer: the duck's lifer place alone. countries: the three
// species with lifer countries only and no seen-here.
function seeded(variant: Variant = 'full') {
  const reduce = makeReducer({ species, countryName: name })
  const saved = emptySaved()
  saved.records.ebird = variant === 'full' || variant === 'many'
    ? [
        { code: 'duck1', source: 'ebird', date: '2020-01-01', place: { country: 'CA', sub1: 'CA-BC' }, seen: ['2020-01-01|CA-BC|Capital', '2021-01-01|US-WA|King', ...(variant === 'many' ? Object.keys(MORE).map((c) => `2023-01-01|${c}`) : [])] },
        { code: 'crow1', source: 'ebird', date: '2019-01-01', place: { country: 'EG' }, seen: ['2019-01-01|EG', '2022-01-01|CA-BC'] },
        { code: 'owl1', source: 'ebird', date: '2021-01-01', place: { country: 'CA', sub1: 'CA-ON' }, seen: ['2021-01-01|CA-ON'] },
      ]
    : variant === 'countries'
    ? [
        { code: 'duck1', source: 'ebird', date: '2020-01-01', place: { country: 'CA' } },
        { code: 'crow1', source: 'ebird', date: '2019-01-01', place: { country: 'EG' } },
        { code: 'owl1', source: 'ebird', date: '2021-01-01', place: { country: 'US' } },
      ]
    : [{ code: 'duck1', source: 'ebird', date: '2020-01-01', place: { country: 'CA', sub1: 'CA-BC' } }]
  return reduce(initialState(), { type: 'restore', saved })
}

/** Only the owl, seen in Ontario. */
function seededOwl() {
  const saved = emptySaved()
  saved.records.ebird = [{ code: 'owl1', source: 'ebird', date: '2021-01-01', place: { country: 'CA', sub1: 'CA-ON' }, seen: ['2021-01-01|CA-ON'] }]
  return makeReducer({ species, countryName: name })(initialState(), { type: 'restore', saved })
}

function Harness({ variant = 'full', note, unplaced }: { variant?: Variant; note?: PlacesNote; unplaced?: PlacesUnplaced }) {
  const reduce = makeReducer({ species, countryName: name })
  const [state, dispatch] = useReducer(reduce, undefined, () => seeded(variant))
  const [open, setOpen] = useState<Panel | null>(null)
  const time = { entries: state.list, months: monthBins(state.list, '2022-06').months, today: '2022-06' }
  return (
    <>
      <div className="eb-dock">
        <FilterDropdowns state={state} dispatch={dispatch} species={species} regions={regions} open={open} onOpen={setOpen} placesNote={note} placesUnplaced={unplaced} time={time} />
      </div>
      <button type="button">elsewhere</button>
      <button type="button" onClick={() => dispatch({ type: 'filter', filter: { ...state.filter, order: 'Anseriformes' } })}>ducks only</button>
      <button type="button" onClick={() => dispatch({ type: 'filter', filter: { ...state.filter, order: 'Strigiformes' } })}>owls only</button>
      <button type="button" onClick={() => dispatch({ type: 'filter', filter: { ...state.filter, order: 'Passeriformes' } })}>crows only</button>
      <output data-testid="filter">{JSON.stringify(state.filter)}</output>
    </>
  )
}
const filterOf = () => JSON.parse(screen.getByTestId('filter').textContent || '{}')
const placesBtn = () => screen.getByTestId('filter-tab-places')
const timeBtn = () => screen.getByTestId('filter-tab-time')

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Places and Time: dropdowns in the controls bar', () => {
  it('two buttons with aria-expanded; a button opens its panel, a second tap closes it, one panel at a time', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    expect(placesBtn()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(placesBtn())
    expect(placesBtn()).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByRole('dialog', { name: 'Places' })
    expect(placesBtn()).toHaveAttribute('aria-controls', panel.id)
    expect(panel).not.toHaveAttribute('aria-modal') // a popover on wider screens
    fireEvent.click(timeBtn())
    expect(screen.queryByRole('dialog', { name: 'Places' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Time' })).toBeInTheDocument()
    expect(screen.getByTestId('timeline')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Play/ })).toBeNull()
    fireEvent.click(timeBtn())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Places is a checklist of countries: real checkboxes with flags and seen-here counts, sorted by count; several may be checked', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(placesBtn())
    const list = screen.getByRole('list', { name: 'Countries' })
    const boxes = within(list).getAllByRole('checkbox')
    // Canada 3 (seen-here: the crow too), then Egypt 1 and the US 1 by name.
    expect(boxes.map((b) => b.closest('label')!.textContent)).toEqual(['Canada3, 3 species', 'Egypt1, 1 species', 'United States of America1, 1 species'])
    expect(boxes.map((b) => b.closest('label')!.querySelector('img.eb-flag')?.getAttribute('alt'))).toEqual(['', '', ''])
    expect(boxes[0]).toHaveAccessibleName('Canada, 3 species')
    expect(boxes[0]).not.toBeChecked()
    fireEvent.click(screen.getByTestId('country-EG'))
    fireEvent.click(screen.getByTestId('country-US'))
    expect(filterOf()).toEqual({ countries: ['EG', 'US'] })
    expect(screen.getByTestId('country-EG')).toBeChecked()
    // The button says how many, and its accessible name names them.
    expect(placesBtn()).toHaveTextContent('Places · 2')
    expect(placesBtn()).toHaveAccessibleName('Places: Egypt, United States of America')
    fireEvent.click(screen.getByTestId('country-EG'))
    expect(filterOf()).toEqual({ countries: ['US'] })
    fireEvent.click(screen.getByTestId('places-clear'))
    expect(filterOf()).toEqual({})
    expect(screen.queryByTestId('places-clear')).toBeNull()
  })

  it('a search field only for more than SEARCH_FROM countries', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(placesBtn())
    expect(SEARCH_FROM).toBe(8)
    expect(screen.queryByRole('searchbox', { name: 'Find a country' })).toBeNull()
  })

  it('Esc and a press outside close the popover; focus returns to its button', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    placesBtn().focus()
    fireEvent.click(placesBtn())
    expect(screen.getByRole('dialog', { name: 'Places' })).toContainElement(document.activeElement as HTMLElement)
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(placesBtn()).toHaveFocus()
    fireEvent.click(timeBtn())
    fireEvent.pointerDown(screen.getByRole('button', { name: 'elsewhere' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('at phone width the panel is a modal bottom sheet with a close button', () => {
    vi.stubGlobal('innerWidth', 390)
    render(<Harness />)
    fireEvent.click(placesBtn())
    const sheet = screen.getByRole('dialog', { name: 'Places' })
    expect(sheet).toHaveAttribute('aria-modal', 'true')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a range shows on the Time button as years, spoken in full', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(timeBtn())
    const lo = screen.getByRole('slider', { name: 'Start month' })
    vi.useFakeTimers()
    fireEvent.keyDown(lo, { key: 'PageUp' })
    act(() => { vi.advanceTimersByTime(400) })
    vi.useRealTimers()
    expect(filterOf()).toEqual({ from: '2020-01' })
    expect(timeBtn()).toHaveTextContent('Time · from 2020')
    expect(timeBtn()).toHaveAccessibleName('Time: from January 2020')
  })

  it('the lifer-only notice, inside Places: add MyEBirdData, or import it again for an old save; both link to its Add panel', () => {
    vi.stubGlobal('innerWidth', 1000)
    const { unmount } = render(<Harness variant="lifer" note="add" />)
    fireEvent.click(placesBtn())
    expect(screen.getByTestId('places-lifer-only')).toHaveTextContent(/^Places only knows where you first recorded each bird\. Add MyEBirdData to filter by every place you recorded each bird, down to the county\.$/)
    expect(screen.getByRole('link', { name: 'Add MyEBirdData' })).toHaveAttribute('href', '/settings#add-mydata')
    unmount()
    render(<Harness variant="lifer" note="reimport" />)
    fireEvent.click(placesBtn())
    expect(screen.getByTestId('places-lifer-only')).toHaveTextContent(/^Places only knows where you first recorded each bird\. Import MyEBirdData again to filter by every place you recorded each bird\.$/)
    expect(screen.getByRole('link', { name: 'Import MyEBirdData again' })).toHaveAttribute('href', '/settings#add-mydata')
  })

  it('observation.org life list birds with no places: a line above the lifer-only note, linking to the observations Add panel', () => {
    vi.stubGlobal('innerWidth', 1000)
    const { unmount } = render(<Harness variant="lifer" note="add" unplaced="add" />)
    fireEvent.click(placesBtn())
    const line = screen.getByTestId('places-unplaced')
    expect(line).toHaveClass('eb-note', 'eb-places-note')
    expect(line).toHaveTextContent(/^Birds only on your observation\.org life list have no places, so a place filter leaves them out\. Add the observations export to place them by country and province\.$/)
    expect(within(line).getByRole('link', { name: 'Add the observations export' })).toHaveAttribute('href', '/settings#add-obsorg')
    const lifer = screen.getByTestId('places-lifer-only')
    expect(line.compareDocumentPosition(lifer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    unmount()
    render(<Harness variant="lifer" unplaced="add" />)
    fireEvent.click(placesBtn())
    expect(screen.getByTestId('places-unplaced')).toBeInTheDocument()
    expect(screen.queryByTestId('places-lifer-only')).toBeNull()
  })

  it('with the observations on the list: the first sentence only, no link', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness variant="lifer" unplaced="plain" />)
    fireEvent.click(placesBtn())
    const line = screen.getByTestId('places-unplaced')
    expect(line).toHaveTextContent(/^Birds only on your observation\.org life list have no places, so a place filter leaves them out\.$/)
    expect(within(line).queryByRole('link')).toBeNull()
  })

  it('no unplaced line without the prop', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness variant="lifer" note="add" />)
    fireEvent.click(placesBtn())
    expect(screen.queryByTestId('places-unplaced')).toBeNull()
  })
})

describe('Places drills down: country, then state or province, then county', () => {
  it('a country with provinces has a drill button; drilling shows its provinces under a breadcrumb, focus on "All of Canada"', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(placesBtn())
    expect(screen.queryByTestId('drill-c:EG')).toBeNull()
    expect(screen.queryByTestId('places-path')).toBeNull()
    expect(screen.getByTestId('drill-c:CA')).toHaveAccessibleName('Show states and provinces in Canada')
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    expect(screen.getByTestId('places-path')).toHaveTextContent('All countries/Canada')
    expect(within(screen.getByTestId('places-path')).getByText('Canada')).toHaveAttribute('aria-current', 'location')
    expect(screen.getByText(/States and provinces · 2/)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'States and provinces' })).toBeInTheDocument()
    expect(screen.getByTestId('place-all')).toHaveFocus()
    expect(screen.getByTestId('place-all')).toHaveAccessibleName('All of Canada, 3 species')
    expect(screen.getByRole('checkbox', { name: 'British Columbia, 2 species' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Ontario, 1 species' })).toBeInTheDocument()
    expect(screen.getByTestId('drill-s:CA-BC')).toHaveAccessibleName('Show counties in British Columbia')
    expect(screen.queryByTestId('drill-s:CA-ON')).toBeNull()
    // Flags on country rows only.
    expect(screen.getByTestId('filter-panel-places').querySelector('img.eb-flag')).toBeNull()
  })

  it('checking a province narrows a checked country; the button counts and names it', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(placesBtn())
    fireEvent.click(screen.getByTestId('country-CA'))
    expect(filterOf()).toEqual({ countries: ['CA'] })
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    expect(screen.getByTestId('place-all')).toBeChecked()
    fireEvent.click(screen.getByTestId('place-s:CA-BC'))
    expect(filterOf()).toEqual({ provinces: ['CA-BC'] })
    expect(screen.getByTestId('place-all')).not.toBeChecked()
    expect(screen.getByTestId('place-s:CA-BC')).toBeChecked()
    expect(placesBtn()).toHaveTextContent('Places · 1')
    expect(placesBtn()).toHaveAccessibleName('Places: British Columbia, Canada')
    // "All of Canada" checks the country again, which holds the province.
    fireEvent.click(screen.getByTestId('place-all'))
    expect(filterOf()).toEqual({ countries: ['CA'] })
  })

  it('counties: drill again, check one; the breadcrumb steps back and focus returns to the drill button', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(placesBtn())
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    fireEvent.click(screen.getByTestId('drill-s:CA-BC'))
    expect(screen.getByTestId('places-path')).toHaveTextContent('All countries/Canada/British Columbia')
    expect(screen.getByText(/Counties · 1/)).toBeInTheDocument()
    expect(screen.getByTestId('place-all')).toHaveAccessibleName('All of British Columbia, 2 species')
    expect(screen.getByTestId('place-all')).toHaveFocus()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Capital, 1 species' }))
    expect(filterOf()).toEqual({ counties: ['CA-BC|Capital'] })
    expect(placesBtn()).toHaveAccessibleName('Places: Capital, British Columbia')
    // One step back: Canada's provinces, focus on British Columbia's drill button.
    fireEvent.click(within(screen.getByTestId('places-path')).getByRole('button', { name: 'Canada' }))
    expect(screen.getByText(/States and provinces · 2/)).toBeInTheDocument()
    expect(screen.getByTestId('drill-s:CA-BC')).toHaveFocus()
    fireEvent.click(screen.getByTestId('drill-s:CA-BC'))
    fireEvent.click(within(screen.getByTestId('places-path')).getByRole('button', { name: 'All countries' }))
    expect(screen.queryByTestId('places-path')).toBeNull()
    expect(screen.getByText(/Countries · 3/)).toBeInTheDocument()
    expect(screen.getByTestId('drill-c:CA')).toHaveFocus()
  })

  it('a step back scrolls the drill button it focuses into view', () => {
    vi.stubGlobal('innerWidth', 1000)
    const scrolled: Element[] = []
    const into = vi.fn(function (this: Element) { scrolled.push(this) })
    Element.prototype.scrollIntoView = into
    try {
      render(<Harness />)
      fireEvent.click(placesBtn())
      fireEvent.click(screen.getByTestId('drill-c:CA'))
      fireEvent.click(within(screen.getByTestId('places-path')).getByRole('button', { name: 'All countries' }))
      expect(scrolled.at(-1)).toBe(screen.getByTestId('drill-c:CA'))
    } finally {
      delete (Element.prototype as Partial<Element>).scrollIntoView
    }
  })

  it('Clear clears every level', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(placesBtn())
    fireEvent.click(screen.getByTestId('country-EG'))
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    fireEvent.click(screen.getByTestId('place-s:CA-ON'))
    fireEvent.click(screen.getByTestId('drill-s:CA-BC'))
    fireEvent.click(screen.getByTestId('place-k:CA-BC|Capital'))
    expect(filterOf()).toEqual({ countries: ['EG'], provinces: ['CA-ON'], counties: ['CA-BC|Capital'] })
    fireEvent.click(screen.getByTestId('places-clear'))
    expect(filterOf()).toEqual({})
    expect(screen.queryByTestId('places-clear')).toBeNull()
  })

  it('a province alone shows Clear, and Clear empties it', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(placesBtn())
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    expect(screen.queryByTestId('places-clear')).toBeNull()
    fireEvent.click(screen.getByTestId('place-s:CA-BC'))
    fireEvent.click(screen.getByTestId('places-clear'))
    expect(filterOf()).toEqual({})
  })

  it('reopened, the panel starts at the selection\'s level: Capital checked opens on British Columbia\'s counties', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    // jsdom has no scrollIntoView: record what is scrolled to (removed after the test).
    const scrolled: Element[] = []
    Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this) }
    onTestFinished(() => { delete (Element.prototype as Partial<Element>).scrollIntoView })
    fireEvent.click(placesBtn())
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    fireEvent.click(screen.getByTestId('drill-s:CA-BC'))
    fireEvent.click(screen.getByTestId('place-k:CA-BC|Capital'))
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    fireEvent.click(placesBtn())
    expect(screen.getByText(/^Counties · 1$/)).toBeInTheDocument()
    expect(screen.getByTestId('places-path')).toHaveTextContent('All countries/Canada/British Columbia')
    expect(screen.getByTestId('place-k:CA-BC|Capital')).toBeChecked()
    expect(screen.getByTestId('place-all')).toHaveAccessibleName('All of British Columbia, 2 species')
    expect(scrolled).toContain(screen.getByTestId('place-k:CA-BC|Capital'))
    // A step back lands on the province's drill button, as from a drill.
    fireEvent.click(within(screen.getByTestId('places-path')).getByRole('button', { name: 'Canada' }))
    expect(screen.getByTestId('drill-s:CA-BC')).toHaveFocus()
  })

  it('reopened with places under several parents (or countries only), the panel starts at the countries', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(placesBtn())
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    fireEvent.click(screen.getByTestId('place-s:CA-ON'))
    fireEvent.click(within(screen.getByTestId('places-path')).getByRole('button', { name: 'All countries' }))
    fireEvent.click(screen.getByTestId('drill-c:US'))
    fireEvent.click(screen.getByTestId('place-s:US-WA'))
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    fireEvent.click(placesBtn())
    expect(screen.getByText(/^Countries · 3$/)).toBeInTheDocument()
    expect(screen.queryByTestId('places-path')).toBeNull()
  })

  it('every county row keeps the drill button\'s room, so the counts stay in one column', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(placesBtn())
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    fireEvent.click(screen.getByTestId('drill-s:CA-BC'))
    const level = screen.getByRole('list', { name: 'Counties' })
    for (const li of level.querySelectorAll('li.eb-places-row')) expect(li.querySelector('.eb-drill-space')).not.toBeNull()
  })

  it('a checked place that another filter empties stays listed at 0 so it can be unchecked', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(placesBtn())
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    fireEvent.click(screen.getByTestId('place-s:CA-ON'))
    fireEvent.click(screen.getByRole('button', { name: 'ducks only' }))
    expect(filterOf()).toEqual({ order: 'Anseriformes', provinces: ['CA-ON'] })
    const ontario = screen.getByTestId('place-s:CA-ON')
    expect(ontario).toBeChecked()
    expect(ontario).toHaveAccessibleName('Ontario, 0 species')
    fireEvent.click(ontario)
    expect(filterOf()).toEqual({ order: 'Anseriformes' })
  })

  it('a drilled level with nothing left under the other filters says so, the breadcrumb kept', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(placesBtn())
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    fireEvent.click(screen.getByTestId('drill-s:CA-BC'))
    // The owl was only ever seen in Ontario: nothing in British Columbia's counties is left.
    fireEvent.click(screen.getByRole('button', { name: 'owls only' }))
    const level = screen.getByRole('list', { name: 'Counties' })
    expect(within(level).getByTestId('places-empty')).toHaveTextContent('No places here under the other filters.')
    expect(screen.getByTestId('places-empty').tagName).toBe('LI')
    // "All of British Columbia" stays, so the province itself can still be checked; nothing else.
    expect(screen.queryAllByRole('checkbox')).toEqual([screen.getByTestId('place-all')])
    expect(screen.getByTestId('place-all')).toHaveAccessibleName('All of British Columbia, 0 species')
    expect(screen.getByTestId('places-path')).toHaveTextContent('All countries/Canada/British Columbia')
  })

  it('a drilled level the list itself no longer reaches says the list changed, not the other filters', async () => {
    vi.stubGlobal('innerWidth', 1000)
    const { PlacesDrill } = await import('@/components/filters/PlacesDrill')
    const full = seeded()
    const { rerender } = render(<PlacesDrill state={full} species={species} regions={regions} onFilter={() => {}} />)
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    fireEvent.click(screen.getByTestId('drill-s:CA-BC'))
    // The same panel, the list now only the owl (Ontario): no other filter is set.
    rerender(<PlacesDrill state={seededOwl()} species={species} regions={regions} onFilter={() => {}} />)
    expect(screen.getByTestId('places-empty')).toHaveTextContent('No places here on your list now.')
    expect(screen.getByTestId('place-all')).toBeInTheDocument()
  })

  it('countries-only lists show no drill buttons and no breadcrumb', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness variant="countries" />)
    fireEvent.click(placesBtn())
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.queryAllByRole('button', { name: /^Show / })).toHaveLength(0)
    expect(screen.queryByTestId('places-path')).toBeNull()
  })

  it('Esc closes the panel from a drilled level and focus returns to the Places button', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    placesBtn().focus()
    fireEvent.click(placesBtn())
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(placesBtn()).toHaveFocus()
  })

  it('at phone width the drilled sheet keeps Tab inside and its drill buttons are buttons', () => {
    vi.stubGlobal('innerWidth', 390)
    render(<Harness />)
    fireEvent.click(placesBtn())
    const sheet = screen.getByRole('dialog', { name: 'Places' })
    expect(sheet).toHaveAttribute('aria-modal', 'true')
    const drill = within(sheet).getByTestId('drill-c:CA')
    expect(drill.tagName).toBe('BUTTON')
    expect(drill).toHaveAttribute('type', 'button')
    fireEvent.click(drill)
    expect(within(sheet).getByTestId('place-all')).toHaveFocus()
    expect(within(sheet).getByTestId('drill-s:CA-BC').tagName).toBe('BUTTON')
    // Tab from the last control wraps to the first (the sheet's close button); Shift+Tab from the first to the last.
    const last = within(sheet).getByTestId('place-s:CA-ON') // British Columbia (2) and its drill button come first
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(within(sheet).getByRole('button', { name: 'Close' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })
})

describe('Preview variants of the Places panel (?v=places:<letter>)', () => {
  // Force a variant in jsdom the way the switch reads it, and never leak it into the next test.
  const withVariant = (v: string) => history.replaceState(null, '', `/?v=places:${v}`)
  afterEach(() => {
    history.replaceState(null, '', '/')
    sessionStorage.removeItem('everybird:variants')
  })

  /** Variant a reopened at a checked county's level: it is shown checked; then the breadcrumb back to the countries. */
  const backToCountries = (county: string) => {
    expect(screen.getByTestId(`place-${county}`)).toBeChecked()
    fireEvent.click(within(screen.getByTestId('places-path')).getByRole('button', { name: 'All countries' }))
  }

  // The same steps in both designs (the test ids are shared): these check that each design reaches and writes the same
  // filter, not which design is on screen; the variant b tests below tell the designs apart.
  describe.each(['a', 'b'] as const)('variant %s', (v) => {
    it.each([
      ['k:US-WA|King', 'c:US', ['c:US', 's:US-WA'], 'United States of America, 0 species'],
      ['k:CA-BC|Capital', 's:CA-BC', ['c:CA', 's:CA-BC'], 'British Columbia, 0 species'],
    ])('a checked %s stays reachable when another filter empties its ancestor %s', (county, ancestor, path, spoken) => {
      vi.stubGlobal('innerWidth', 1000)
      withVariant(v)
      render(<Harness />)
      fireEvent.click(placesBtn())
      for (const k of path) fireEvent.click(screen.getByTestId(`drill-${k}`))
      fireEvent.click(screen.getByTestId(`place-${county}`))
      act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
      // The owl was only ever seen in Ontario.
      fireEvent.click(screen.getByRole('button', { name: 'owls only' }))
      // Reopened, variant a starts at the county's level (its checkbox in view), and b with every ancestor of the county
      // open. From the countries, the emptied ancestor is listed at 0 and still drills or opens.
      fireEvent.click(placesBtn())
      if (v === 'a') backToCountries(county)
      for (const k of path) {
        const btn = screen.getByTestId(`drill-${k}`)
        if (k === ancestor) expect(screen.getByRole('checkbox', { name: spoken })).not.toBeChecked()
        if (v === 'a') fireEvent.click(btn)
        else expect(btn).toHaveAttribute('aria-expanded', 'true')
      }
      const box = screen.getByTestId(`place-${county}`)
      expect(box).toBeChecked()
      fireEvent.click(box)
      expect(filterOf()).toEqual({ order: 'Strigiformes' })
    })

    it('a checked county stays reachable when another filter leaves its province listed with no counties', () => {
      vi.stubGlobal('innerWidth', 1000)
      withVariant(v)
      render(<Harness />)
      fireEvent.click(placesBtn())
      fireEvent.click(screen.getByTestId('drill-c:CA'))
      fireEvent.click(screen.getByTestId('drill-s:CA-BC'))
      fireEvent.click(screen.getByTestId('place-k:CA-BC|Capital'))
      act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
      // The crow was seen in British Columbia, but in no county there.
      fireEvent.click(screen.getByRole('button', { name: 'crows only' }))
      fireEvent.click(placesBtn())
      if (v === 'a') backToCountries('k:CA-BC|Capital')
      for (const k of ['c:CA', 's:CA-BC']) {
        const btn = screen.getByTestId(`drill-${k}`)
        if (k === 's:CA-BC') expect(screen.getByRole('checkbox', { name: 'British Columbia, 1 species' })).not.toBeChecked()
        if (v === 'a') fireEvent.click(btn)
        else expect(btn).toHaveAttribute('aria-expanded', 'true')
      }
      const box = screen.getByRole('checkbox', { name: 'Capital, 0 species' })
      expect(box).toBeChecked()
      fireEvent.click(box)
      expect(filterOf()).toEqual({ order: 'Passeriformes' })
    })

    it('selects a province, then a county, through the same filter', () => {
      vi.stubGlobal('innerWidth', 1000)
      withVariant(v)
      render(<Harness />)
      fireEvent.click(placesBtn())
      fireEvent.click(screen.getByTestId('drill-c:CA'))
      fireEvent.click(screen.getByTestId('place-s:CA-BC'))
      expect(filterOf()).toEqual({ provinces: ['CA-BC'] })
      fireEvent.click(screen.getByTestId('drill-s:CA-BC'))
      fireEvent.click(screen.getByTestId('place-k:CA-BC|Capital'))
      expect(filterOf()).toEqual({ counties: ['CA-BC|Capital'] })
      expect(placesBtn()).toHaveAccessibleName('Places: Capital, British Columbia')
    })
  })

  it('variant b: rows open inline with aria-expanded; focus stays on the toggle; a checked county opens its ancestors on reopen', () => {
    vi.stubGlobal('innerWidth', 1000)
    withVariant('b')
    render(<Harness />)
    placesBtn().focus()
    fireEvent.click(placesBtn())
    const canada = screen.getByTestId('drill-c:CA')
    expect(canada).toHaveAttribute('aria-expanded', 'false')
    expect(canada).toHaveAccessibleName('States and provinces in Canada')
    expect(canada).not.toHaveAttribute('aria-controls')
    expect(screen.queryByTestId('drill-c:EG')).toBeNull()
    canada.focus()
    fireEvent.click(canada)
    expect(canada).toHaveAttribute('aria-expanded', 'true')
    expect(canada).toHaveFocus()
    const sub = screen.getByRole('list', { name: 'States and provinces in Canada' })
    expect(canada).toHaveAttribute('aria-controls', sub.id)
    expect(sub).toHaveClass('eb-places-sub')
    expect(within(sub).getByRole('checkbox', { name: 'British Columbia, 2 species' })).toBeInTheDocument()
    expect(within(sub).getByRole('checkbox', { name: 'Ontario, 1 species' })).toBeInTheDocument()
    // One checklist: the other countries stay beside the open group; the head stays on countries.
    expect(screen.getByTestId('country-EG')).toBeInTheDocument()
    expect(screen.getByTestId('country-US')).toBeInTheDocument()
    expect(screen.getByText(/Countries · 3/)).toBeInTheDocument()
    expect(screen.queryByTestId('places-path')).toBeNull()
    expect(screen.queryByTestId('place-all')).toBeNull()
    // Flags on country rows only.
    expect(sub.querySelector('img.eb-flag')).toBeNull()
    const bc = screen.getByTestId('drill-s:CA-BC')
    expect(bc).toHaveAccessibleName('Counties in British Columbia')
    bc.focus()
    fireEvent.click(bc)
    expect(bc).toHaveFocus()
    fireEvent.click(screen.getByTestId('place-k:CA-BC|Capital'))
    expect(filterOf()).toEqual({ counties: ['CA-BC|Capital'] })
    // The parent is its own "all": it isn't drawn checked by a checked descendant.
    expect(screen.getByTestId('country-CA')).not.toBeChecked()
    // Closing a group keeps focus on its toggle and computes nothing under it.
    bc.focus()
    fireEvent.click(bc)
    expect(bc).toHaveAttribute('aria-expanded', 'false')
    expect(bc).toHaveFocus()
    expect(screen.queryByTestId('place-k:CA-BC|Capital')).toBeNull()
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(placesBtn())
    expect(screen.getByTestId('drill-c:CA')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('drill-s:CA-BC')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('place-k:CA-BC|Capital')).toBeChecked()
  })

  it('variant b: several groups may be open; Clear clears every level', () => {
    vi.stubGlobal('innerWidth', 1000)
    withVariant('b')
    render(<Harness />)
    fireEvent.click(placesBtn())
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    fireEvent.click(screen.getByTestId('drill-c:US'))
    expect(screen.getByRole('list', { name: 'States and provinces in Canada' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'States and provinces in United States of America' })).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('country-EG'))
    fireEvent.click(screen.getByTestId('place-s:US-WA'))
    expect(filterOf()).toEqual({ countries: ['EG'], provinces: ['US-WA'] })
    fireEvent.click(screen.getByTestId('places-clear'))
    expect(filterOf()).toEqual({})
  })

  it('variant b: the search matches countries only; an open group under a matching country stays shown', () => {
    vi.stubGlobal('innerWidth', 1000)
    withVariant('b')
    render(<Harness variant="many" />)
    fireEvent.click(placesBtn())
    expect(screen.getByText(/Countries · 10/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    const find = screen.getByTestId('places-find')
    fireEvent.change(find, { target: { value: 'can' } })
    expect(screen.getByTestId('country-CA')).toBeInTheDocument()
    expect(screen.getByTestId('place-s:CA-BC')).toBeInTheDocument()
    expect(screen.queryByTestId('country-EG')).toBeNull()
    // A province's name doesn't match a country search.
    fireEvent.change(find, { target: { value: 'british' } })
    expect(screen.queryByTestId('place-s:CA-BC')).toBeNull()
    expect(screen.getByText('No country matches.')).toBeInTheDocument()
  })

  it('variant b: a group whose places another filter empties folds away with its button, and comes back open', () => {
    vi.stubGlobal('innerWidth', 1000)
    withVariant('b')
    render(<Harness />)
    fireEvent.click(placesBtn())
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    fireEvent.click(screen.getByTestId('drill-s:CA-BC'))
    // The crow was seen in British Columbia, but in no county there: a row's children come from the same filtered
    // sightings as its group, so the group can't be open and empty (variant a's "No places here" has no b twin).
    fireEvent.click(screen.getByRole('button', { name: 'crows only' }))
    expect(screen.getByRole('checkbox', { name: 'British Columbia, 1 species' })).toBeInTheDocument()
    expect(screen.queryByTestId('drill-s:CA-BC')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Counties in British Columbia' })).toBeNull()
    expect(screen.queryByText('No places here under the other filters.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'ducks only' }))
    expect(screen.getByTestId('drill-s:CA-BC')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('place-k:CA-BC|Capital')).toBeInTheDocument()
  })

  describe.each(['a', 'b'] as const)('variant %s counts the list once per change of the other filters', (v) => {
    it('not again for a checkbox, a drill or an open group; again for an order', () => {
      vi.stubGlobal('innerWidth', 1000)
      withVariant(v)
      render(<Harness />)
      counted.mockClear()
      fireEvent.click(placesBtn())
      expect(counted).toHaveBeenCalledTimes(1)
      fireEvent.click(screen.getByTestId('country-EG'))
      fireEvent.click(screen.getByTestId('drill-c:CA'))
      if (v === 'b') fireEvent.click(screen.getByTestId('drill-c:US'))
      fireEvent.click(screen.getByTestId('place-s:CA-BC'))
      fireEvent.click(screen.getByTestId('drill-s:CA-BC'))
      fireEvent.click(screen.getByTestId('place-k:CA-BC|Capital'))
      expect(filterOf()).toEqual({ countries: ['EG'], counties: ['CA-BC|Capital'] })
      expect(counted).toHaveBeenCalledTimes(1)
      fireEvent.click(screen.getByRole('button', { name: 'ducks only' }))
      expect(counted).toHaveBeenCalledTimes(2)
    })
  })

  it('without a ?v the panel is variant a', () => {
    vi.stubGlobal('innerWidth', 1000)
    render(<Harness />)
    fireEvent.click(placesBtn())
    expect(screen.getByTestId('drill-c:CA')).not.toHaveAttribute('aria-expanded')
    fireEvent.click(screen.getByTestId('drill-c:CA'))
    expect(screen.getByTestId('places-path')).toBeInTheDocument()
  })
})
