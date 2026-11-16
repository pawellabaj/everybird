// @vitest-environment jsdom
// Item 9, part D: the dock search's "Understood as" chips, Enter and "Show these birds", the seen-dates note, and
// the picks that worked before (a bird name, an order). The groups file is mocked; the list is a synthetic one.
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DockSearchField } from '@/components/app/DockSearch'
import { fetchData } from '@/lib/data-url'
import type { Filter } from '@/lib/list/filters'
import type { GroupsFile } from '@/lib/search/groups'
import { buildSpeciesIndex } from '@/lib/species/load'
import type { Regions, SpeciesRow } from '@/lib/species/types'
import { withI18n } from './i18n-render'

vi.mock('@/lib/data-url', () => ({
  fetchData: vi.fn(async () => ({
    v: 1,
    taxonomy: 'test',
    groups: [{ id: 'waterfowl', name: { en: 'Waterfowl', es: 'Patos', pt: 'Patos', nl: 'Eenden' }, lo: 1, hi: 100 }],
  } satisfies GroupsFile)),
}))

const sp = (code: string, com: string, sci: string, ord: string, fam: string, famCom: string, to: number, g: number): SpeciesRow =>
  ({ code, com, sci, ord, fam, famCom, to, g, gSrc: 'avonet', st: true, ar: 1, q: true })
const species = buildSpeciesIndex([
  sp('snogoo', 'Snow Goose', 'Anser caerulescens', 'Anseriformes', 'Anatidae', 'Ducks, Geese, and Waterfowl', 1, 2700),
  sp('amerob', 'American Robin', 'Turdus migratorius', 'Passeriformes', 'Turdidae', 'Thrushes', 4, 77),
])
const regions: Regions = { v: 1, countries: { CA: 'Canada' }, sub1: { 'CA-BC': 'British Columbia' } }
const entries = [{ code: 'snogoo' }, { code: 'amerob' }]

type Props = Partial<Parameters<typeof DockSearchField>[0]>
function renderSearch(over: Props = {}) {
  const onApply = vi.fn<(f: Filter) => void>()
  const onPick = vi.fn()
  const onClose = vi.fn()
  const props = {
    entries,
    species,
    onPick,
    open: true,
    onClose,
    within: createRef<HTMLElement>(),
    filter: {} as Filter,
    onApply,
    regions,
    listPlaces: [],
    hasMonths: true,
    whose: 'your' as const,
    ...over,
  }
  const view = render(<DockSearchField {...props} />, { wrapper: withI18n('en') })
  return { ...view, onApply, onPick, onClose }
}

const box = () => screen.getByRole('combobox')
const type = async (text: string) => {
  await act(async () => { fireEvent.change(box(), { target: { value: text } }) })
}
const understood = () => screen.queryByRole('group', { name: 'Understood as' })

afterEach(() => {
  cleanup()
  vi.mocked(fetchData).mockClear()
})

describe('the understood chips', () => {
  it('appear under the field for a group, a place and a period, and a plain name shows none', async () => {
    renderSearch()
    await act(async () => {}) // the groups file arrives
    await type('waterfowl canada 2026')
    const row = understood()!
    expect(row).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Remove Waterfowl filter' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Remove Canada filter' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Remove Seen: 2026 filter' })).toBeInTheDocument()
    await type('robin')
    expect(understood()).toBeNull()
  })

  it('a × removes that chip\'s words from the query, and the others stay', async () => {
    renderSearch()
    await act(async () => {})
    await type('waterfowl canada 2026')
    fireEvent.click(within(understood()!).getByRole('button', { name: 'Remove Canada filter' }))
    expect(box()).toHaveValue('waterfowl 2026')
    expect(within(understood()!).queryByRole('button', { name: 'Remove Canada filter' })).toBeNull()
    expect(within(understood()!).getByRole('button', { name: 'Remove Seen: 2026 filter' })).toBeInTheDocument()
  })

  it('Enter applies the chips in one filter, and closes the search with focus back on the magnifier', async () => {
    const { onApply, onClose } = renderSearch()
    await act(async () => {})
    await type('waterfowl canada 2026')
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply.mock.calls[0][0]).toEqual({ group: 'waterfowl', countries: ['CA'], from: '2026-01', to: '2026-12', basis: 'seen' })
    expect(onClose).toHaveBeenCalledWith(true)
  })

  it('"Show these birds" applies the same filter', async () => {
    const { onApply } = renderSearch()
    await act(async () => {})
    await type('canada 2026')
    fireEvent.click(screen.getByRole('button', { name: 'Show these birds' }))
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply.mock.calls[0][0]).toEqual({ countries: ['CA'], from: '2026-01', to: '2026-12', basis: 'seen' })
  })

  it('typing applies nothing', async () => {
    const { onApply } = renderSearch()
    await act(async () => {})
    await type('waterfowl canada 2026')
    expect(onApply).not.toHaveBeenCalled()
  })
})

describe('the seen-dates note', () => {
  it('shows for a dates query on your own list without per-place months, and not with them or on a shared view', async () => {
    const { unmount } = renderSearch({ hasMonths: false })
    await act(async () => {})
    await type('canada 2026')
    expect(screen.getByText('Your list only has first-seen dates; import MyEBirdData.csv for every sighting')).toBeInTheDocument()
    unmount()
    const withMonths = renderSearch({ hasMonths: true })
    await act(async () => {})
    await type('canada 2026')
    expect(screen.queryByText(/first-seen dates/)).toBeNull()
    withMonths.unmount()
    renderSearch({ hasMonths: false, whose: 'this' })
    await act(async () => {})
    await type('canada 2026')
    expect(screen.queryByText(/first-seen dates/)).toBeNull()
  })
})

describe('the picks that worked before', () => {
  it('a bird name still lists and Enter picks the first bird', async () => {
    const { onPick, onApply } = renderSearch()
    await act(async () => {})
    await type('robin')
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1)
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ kind: 'species', value: 'amerob' }))
    expect(onApply).not.toHaveBeenCalled()
  })

  it('a bird name with a place still lists the name, and Enter applies the place', async () => {
    const { onPick, onApply } = renderSearch()
    await act(async () => {})
    await type('robin canada')
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1)
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(onApply).toHaveBeenCalledWith({ countries: ['CA'] })
    expect(onPick).not.toHaveBeenCalled()
  })

  it('an order still lists and a click on it picks the order', async () => {
    const { onPick } = renderSearch()
    await act(async () => {})
    await type('anseriformes')
    const option = within(screen.getByRole('listbox')).getAllByRole('option').find((o) => o.textContent?.includes('Anseriformes') || o.textContent?.includes('Waterfowl') || o.textContent?.includes('Ducks'))
    expect(option).toBeDefined()
    fireEvent.click(option!)
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ kind: 'order' }))
  })

  it('a query with no bird and no chip still says so', async () => {
    renderSearch()
    await act(async () => {})
    await type('zzzz')
    expect(screen.getByRole('listbox')).toHaveTextContent('No bird on your list matches “zzzz”.')
  })
})
