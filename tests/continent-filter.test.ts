// Continents as a Places value (Filter.continents): matching (OR with the place levels), the per-continent counts,
// the setters, the key, chips, validation and the labels. Synthetic fixtures only.
import { describe, expect, it } from 'vitest'
import { en } from '@/i18n/messages/en'
import { ALL, filterChips, withoutFilterChip } from '@/lib/list/chips'
import { filterLabel } from '@/lib/share/image'
import { filtersCount, filtersSpoken, placesLabel, placesSpoken } from '@/lib/list/filter-summary'
import { applyFilter, clearPlaces, continentRows, filterKey, filterToShow, hasPlaces, placeCounts, toggleContinent, togglePlace, withContinents, withPlaces, type Filter } from '@/lib/list/filters'
import { applyFilterValidity } from '@/lib/list/filters-validate'
import type { ListEntry } from '@/lib/list/model'
import type { SeenIndex } from '@/lib/list/seen'
import type { SpeciesIndex } from '@/lib/species/load'
import type { Regions } from '@/lib/species/types'

const row = (code: string, ord: string, fam: string) => ({ code, com: code, sci: code, ord, fam, famCom: fam, to: 1 }) as never
const rows = [row('duck', 'Anseriformes', 'Anatidae'), row('owl', 'Strigiformes', 'Strigidae'), row('crow', 'Passeriformes', 'Corvidae'), row('wren', 'Passeriformes', 'Troglodytidae'), row('finch', 'Passeriformes', 'Fringillidae')]
const species: SpeciesIndex = { rows, byCode: new Map(rows.map((r) => [(r as { code: string }).code, r])), search: () => [] } as unknown as SpeciesIndex
const e = (code: string, country: string, date = '2020-01-01'): ListEntry => ({ code, date, place: { country }, heard: false, dead: false, media: false, sources: [] })
// Lifer places only (no seen index): duck CA, owl CA, crow EG, wren KE (Africa), finch AU (Oceania).
const list = [e('duck', 'CA'), e('owl', 'CA'), e('crow', 'EG'), e('wren', 'KE'), e('finch', 'AU')]
const regions: Regions = { v: 1, countries: { CA: 'Canada', EG: 'Egypt', KE: 'Kenya', AU: 'Australia', TZ: 'Tanzania', FR: 'France' }, sub1: { 'CA-BC': 'British Columbia' } }
const codes = (xs: ListEntry[]) => xs.map((x) => x.code)

describe('continents in matching', () => {
  it('a continent matches the species seen in any country on it', () => {
    expect(codes(applyFilter(list, { continents: ['AF'] }, species))).toEqual(['crow', 'wren'])
    expect(codes(applyFilter(list, { continents: ['AF', 'OC'] }, species))).toEqual(['crow', 'wren', 'finch'])
  })

  it('combines with the place levels as one OR set', () => {
    expect(codes(applyFilter(list, { continents: ['AF'], countries: ['CA'] }, species))).toEqual(['duck', 'owl', 'crow', 'wren'])
    expect(codes(applyFilter(list, { continents: ['AF'], provinces: ['CA-BC'] }, species))).toEqual(['crow', 'wren'])
  })

  it('combines with the other filters as AND', () => {
    expect(codes(applyFilter(list, { continents: ['AF'], order: 'Passeriformes' }, species))).toEqual(['crow', 'wren'])
    expect(codes(applyFilter(list, { continents: ['AF'], order: 'Anseriformes' }, species))).toEqual([])
  })

  it('uses the seen-here places when given: a species seen in an African country matches, its lifer place does not', () => {
    const seen: SeenIndex = {
      byCode: new Map([['duck', { places: [{ country: 'CA' }, { country: 'TZ' }], keys: new Set(['c:CA', 'c:TZ']) }]]),
      full: true,
      sig: 'x',
    }
    expect(codes(applyFilter(list, { continents: ['AF'] }, species, seen))).toEqual(['duck', 'crow', 'wren'])
  })
})

describe('continent counts', () => {
  it('counts each species once per continent, whatever countries it was seen in there', () => {
    const seen: SeenIndex = {
      byCode: new Map([['duck', { places: [{ country: 'KE' }, { country: 'TZ' }], keys: new Set(['c:KE', 'c:TZ']) }]]),
      full: true,
      sig: 'x',
    }
    // duck (KE and TZ, both African, counted once), crow (EG) and wren (KE): three species in Africa.
    const counts = placeCounts(list, {}, species, seen)
    expect(counts.continents.get('AF')?.n).toBe(3)
  })

  it('continentRows: only continents with species, in display order, plus a checked one at 0', () => {
    const counts = placeCounts(list, {}, species)
    // North America: duck and owl (CA); Africa: crow (EG) and wren (KE); Oceania: finch (AU).
    expect(continentRows(counts, {}).map((r) => [r.value, r.count])).toEqual([['AF', 2], ['NA', 2], ['OC', 1]])
    const withSa = continentRows(counts, { continents: ['SA'] })
    expect(withSa.find((r) => r.value === 'SA')).toEqual({ value: 'SA', label: 'South America', count: 0, checked: true })
    expect(withSa.find((r) => r.value === 'AN')).toBeUndefined()
  })

  it('the counts are made under the other filters: only what the order holds', () => {
    const counts = placeCounts(list, { order: 'Anseriformes' }, species)
    expect(continentRows(counts, { order: 'Anseriformes' }).map((r) => r.value)).toEqual(['NA'])
  })
})

describe('setters', () => {
  it('toggleContinent adds and removes, in CONTINENTS order', () => {
    const a = toggleContinent({}, 'OC')
    expect(a).toEqual({ continents: ['OC'] })
    expect(toggleContinent(a, 'AF')).toEqual({ continents: ['AF', 'OC'] })
    expect(toggleContinent({ continents: ['AF', 'OC'] }, 'AF')).toEqual({ continents: ['OC'] })
    expect(toggleContinent({ continents: ['OC'] }, 'OC')).toEqual({})
  })

  it('withContinents drops unknown ids and duplicates, sorts, and drops the field when empty', () => {
    expect(withContinents({}, ['OC', 'AF', 'AF', 'XX'])).toEqual({ continents: ['AF', 'OC'] })
    expect(withContinents({ continents: ['AF'] }, [])).toEqual({})
  })

  it('a country toggle or uncheck keeps the continents; clearPlaces drops both', () => {
    expect(togglePlace({ countries: ['CA'], continents: ['AF'] }, 'c:CA')).toEqual({ continents: ['AF'] })
    expect(togglePlace({ continents: ['AF'] }, 'c:CA')).toEqual({ continents: ['AF'], countries: ['CA'] })
    expect(withPlaces({ countries: ['CA'], continents: ['AF'] }, [])).toEqual({ continents: ['AF'] })
    expect(clearPlaces({ countries: ['CA'], provinces: ['CA-BC'], continents: ['AF'], order: 'Anseriformes' })).toEqual({ order: 'Anseriformes' })
  })

  it('hasPlaces is true for a continent alone; filtersCount counts it as Places', () => {
    expect(hasPlaces({ continents: ['AF'] })).toBe(true)
    expect(filtersCount({ continents: ['AF'] })).toBe(1)
    expect(filtersCount({ continents: ['AF'], countries: ['CA'], statuses: ['VU'] })).toBe(2)
  })

  it('filterKey adds a continent part in sorted order', () => {
    expect(filterKey({ continents: ['AF', 'EU'], countries: ['CA'] })).toBe('c:CA|t:AF,EU')
    expect(filterKey({ continents: ['AF'] })).toBe('t:AF')
    expect(filterKey({})).toBe('')
  })
})

describe('filterToShow with continents', () => {
  it('keeps a continent that already holds the bird; clears the places when nothing holds it', () => {
    expect(filterToShow({ continents: ['AF'] }, list[2], species)).toEqual({ continents: ['AF'] })
    expect(filterToShow({ continents: ['AF'], countries: ['CA'] }, list[0], species)).toEqual({ continents: ['AF'], countries: ['CA'] })
    expect(filterToShow({ continents: ['AF'], countries: ['CA'] }, list[4], species)).toEqual({})
  })
})

describe('validation', () => {
  it('drops unknown ids and duplicates, keeps the rest in order, and never keeps an empty list', () => {
    expect(applyFilterValidity({ continents: ['OC', 'AF', 'AF', 'ZZ'] as never }, list, species, false)).toEqual({ continents: ['AF', 'OC'] })
    expect(applyFilterValidity({ continents: ['ZZ'] as never }, list, species, false)).toEqual({})
  })

  it('a list change (pruneValues) drops a continent no species was seen in; without it the continent stays', () => {
    expect(applyFilterValidity({ continents: ['SA'] }, list, species, true)).toEqual({})
    expect(applyFilterValidity({ continents: ['SA'] }, list, species, false)).toEqual({ continents: ['SA'] })
    expect(applyFilterValidity({ continents: ['AF'] }, list, species, true)).toEqual({ continents: ['AF'] })
  })
})

describe('chips and labels', () => {
  it('a continent is its own chip, first, named by the continent, removed by its own token', () => {
    const f: Filter = { continents: ['AF'], countries: ['CA'] }
    const chips = filterChips(f, regions, en.ui)
    expect(chips.map((c) => [c.label, c.token])).toEqual([['Africa', 'continent:AF'], ['Canada', 'c:CA']])
    expect(withoutFilterChip(f, chips[0])).toEqual({ countries: ['CA'] })
    expect(withoutFilterChip(f, chips[1])).toEqual({ continents: ['AF'] })
  })

  it('continents count toward the three-chip rule as places', () => {
    const f: Filter = { continents: ['AF', 'OC'], countries: ['CA', 'EG'] }
    const [collapsed] = filterChips(f, regions, en.ui)
    expect(collapsed).toEqual({ kind: 'place', label: '4 places', token: ALL, spoken: placesSpoken(f, regions, en.ui) })
    expect(withoutFilterChip(f, collapsed)).toEqual({})
    expect(filterChips({ continents: ['AF'], countries: ['CA', 'EG'] }, regions, en.ui)).toHaveLength(3)
  })

  it('the Places label names continents first: "Africa + Canada"; the spoken name lists them by name', () => {
    expect(placesLabel({ continents: ['AF'], countries: ['CA'] }, regions, en.ui)).toBe('Africa + Canada')
    expect(placesLabel({ continents: ['AF', 'EU', 'OC'], countries: ['CA'] }, regions, en.ui)).toBe('Africa and 3 more')
    expect(placesSpoken({ continents: ['AF'], countries: ['EG', 'KE'] }, regions, en.ui)).toBe('Africa; Egypt, Kenya')
    expect(placesSpoken({ continents: ['AF'] }, regions, en.ui)).toBe('Africa')
    expect(filtersSpoken({ continents: ['AF'] }, regions, en.ui)).toBe('Places: Africa')
  })

  it('the share image label reads continents first, with or without the regions', () => {
    const ctx = { species, countryName: (c: string) => regions.countries[c] ?? c }
    expect(filterLabel({ continents: ['AF'], countries: ['CA'] }, { ...ctx, regions }, en.ui)).toBe('Africa + Canada')
    expect(filterLabel({ continents: ['AF'], countries: ['CA'] }, ctx, en.ui)).toBe('Africa + Canada')
    expect(filterLabel({ continents: ['OC'] }, ctx, en.ui)).toBe('Oceania')
  })
})
