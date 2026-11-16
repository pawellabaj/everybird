import { en } from '@/i18n/messages/en'
import { describe, expect, it } from 'vitest'
import { emptyHere } from '@/components/filters/places-shared'
import { applyFilter, filterKey, filterToShow, placeCounts, placeRows, statusOptions, threatenedCount, toggleStatus, withStatuses } from '@/lib/list/filters'
import { applyFilterValidity } from '@/lib/list/filters-validate'
import type { ListEntry } from '@/lib/list/model'
import { buildSpeciesIndex } from '@/lib/species/load'
import type { SpeciesRow } from '@/lib/species/types'
import type { IucnCat } from '@/lib/species/iucn'

const row = (code: string, ord: string, fam: string, to: number, iu?: IucnCat) =>
  ({ code, com: code, sci: code, ord, fam, famCom: fam, to, ...(iu ? { iu } : {}) }) as unknown as SpeciesRow
const species = buildSpeciesIndex([
  row('duck', 'Anseriformes', 'Anatidae', 1, 'LC'),
  row('owl', 'Strigiformes', 'Strigidae', 5, 'VU'),
  row('crow', 'Passeriformes', 'Corvidae', 10, 'EN'),
  row('robin', 'Passeriformes', 'Turdidae', 12),
])
const entry = (code: string): ListEntry => ({ code, date: '2020-01-01', heard: false, dead: false, media: false, sources: ['ebird'] })
const list = ['duck', 'owl', 'crow', 'robin'].map(entry)
const codes = (f: object) => applyFilter(list, f, species).map((e) => e.code).sort()

describe('the Status filter', () => {
  it('keeps the species in any checked category; species without a status are left out', () => {
    expect(codes({ statuses: ['VU', 'EN'] })).toEqual(['crow', 'owl'])
    expect(codes({ statuses: ['LC'] })).toEqual(['duck'])
    expect(codes({})).toContain('robin')
  })
  it('combines with taxonomy by AND', () => {
    expect(codes({ order: 'Passeriformes', statuses: ['EN', 'VU'] })).toEqual(['crow'])
  })
  it('statusOptions: counted under the other filters, whatever is checked, in Red List order', () => {
    expect(statusOptions(list, {}, species).map((o) => [o.value, o.count, o.label])).toEqual([
      ['LC', 1, 'Least Concern'], ['VU', 1, 'Vulnerable'], ['EN', 1, 'Endangered'],
    ])
    expect(statusOptions(list, { statuses: ['LC'] }, species)).toEqual(statusOptions(list, {}, species))
    expect(statusOptions(list, { order: 'Strigiformes' }, species).map((o) => o.value)).toEqual(['VU'])
  })
  it('toggle and normalise', () => {
    expect(toggleStatus({}, 'EN')).toEqual({ statuses: ['EN'] })
    expect(toggleStatus({ statuses: ['EN'] }, 'EN')).toEqual({})
    expect(toggleStatus({ statuses: ['EN'] }, 'VU')).toEqual({ statuses: ['VU', 'EN'] })
    expect(withStatuses({}, ['CR', 'VU', 'VU', 'NE', 'xx'])).toEqual({ statuses: ['VU', 'CR'] })
    expect(withStatuses({ order: 'X', statuses: ['VU'] }, [])).toEqual({ order: 'X' })
  })
  it('keys: unchanged without statuses, i: last', () => {
    expect(filterKey({ order: 'X' })).toBe('o:X')
    expect(filterKey({ order: 'X', statuses: ['VU', 'EN'] })).toBe('o:X|i:VU,EN')
    expect(filterKey({ order: 'X', from: '2020-01', statuses: ['EN'] })).toBe('o:X|r:2020-01~|i:EN')
    // In Red List order whatever order the array holds, so equal filters share a key.
    expect(filterKey({ statuses: ['EN', 'VU'] })).toBe('i:VU,EN')
  })
  it('placeCounts counts the places under a status filter', () => {
    const placed: ListEntry[] = [
      { ...entry('duck'), place: { country: 'CA' } },
      { ...entry('owl'), place: { country: 'CA' } },
      { ...entry('crow'), place: { country: 'EG' } },
      { ...entry('robin'), place: { country: 'EG' } },
    ]
    const rows = (f: object) => placeRows(placeCounts(placed, f, species), undefined, (k) => k).map((o) => [o.value, o.count])
    expect(rows({})).toEqual([['c:CA', 2], ['c:EG', 2]])
    expect(rows({ statuses: ['VU', 'EN'] })).toEqual([['c:CA', 1], ['c:EG', 1]])
    expect(rows({ statuses: ['LC'] })).toEqual([['c:CA', 1]])
  })
  it('an empty drilled Places level names a status filter among the other filters', () => {
    expect(emptyHere({ statuses: ['VU'] }, en.ui)).toBe('No places here under the other filters.')
    expect(emptyHere({}, en.ui)).toBe('No places here on your list now.')
  })
  it('threatened: VU + EN + CR only', () => {
    expect(threatenedCount(list, species)).toBe(2)
  })
  it('a search pick outside the status filter clears it', () => {
    expect(filterToShow({ statuses: ['VU'] }, entry('robin'), species)).toEqual({})
    expect(filterToShow({ statuses: ['VU'] }, entry('owl'), species)).toEqual({ statuses: ['VU'] })
  })
  it('validity: bad values go; after a list change, categories no species has go', () => {
    expect(applyFilterValidity({ statuses: ['EX', 'VU', 'zz'] as never }, list, species, false)).toEqual({ statuses: ['VU', 'EX'] })
    expect(applyFilterValidity({ statuses: ['EX', 'VU'] }, list, species, true)).toEqual({ statuses: ['VU'] })
    expect(applyFilterValidity({ statuses: 'VU' as never }, list, species, false)).toEqual({})
  })
})
