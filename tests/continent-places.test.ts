// Continents as the top level of the Places set (n:AF): matching, ancestry, counts under the other filters, the
// overseas-region rule, countries in no continent, chips, labels and validation. Synthetic fixtures only.
import { describe, expect, it } from 'vitest'
import { ALL, filterChips, withoutFilterChip } from '@/lib/list/chips'
import { filterLabel } from '@/lib/share/image'
import { filtersCount, filtersSpoken, placesLabel, placesSpoken } from '@/lib/list/filter-summary'
import { applyFilter, clearPlaces, countryRows, filterKey, filterPlaceKeys, filterToShow, hasPlaces, onlyOneContinent, placeCounts, placeRows, togglePlace, withPlaces, type Filter } from '@/lib/list/filters'
import { applyFilterValidity } from '@/lib/list/filters-validate'
import type { ListEntry } from '@/lib/list/model'
import { buildSeen } from '@/lib/list/seen'
import type { SpeciesIndex } from '@/lib/species/load'
import type { Regions } from '@/lib/species/types'

const row = (code: string, ord: string, fam: string) => ({ code, com: code, sci: code, ord, fam, famCom: fam, to: 1 }) as never
const rows = [row('duck', 'Anseriformes', 'Anatidae'), row('owl', 'Strigiformes', 'Strigidae'), row('crow', 'Passeriformes', 'Corvidae'), row('wren', 'Passeriformes', 'Troglodytidae'), row('finch', 'Passeriformes', 'Fringillidae')]
const species: SpeciesIndex = { rows, byCode: new Map(rows.map((r) => [(r as { code: string }).code, r])), search: () => [] } as unknown as SpeciesIndex
const e = (code: string, country: string, date = '2020-01-01', sub1?: string): ListEntry => ({ code, date, place: { country, ...(sub1 ? { sub1 } : {}) }, heard: false, dead: false, media: false, sources: [] })
// Lifer places only (no seen index): duck CA, owl CA, crow EG, wren KE (Africa), finch AU (Oceania).
const list = [e('duck', 'CA', '2019-05-01'), e('owl', 'CA', '2020-05-01'), e('crow', 'EG', '2021-05-01'), e('wren', 'KE', '2022-05-01'), e('finch', 'AU', '2023-05-01')]
const regions: Regions = { v: 1, countries: { CA: 'Canada', EG: 'Egypt', KE: 'Kenya', AU: 'Australia', TZ: 'Tanzania', FR: 'France' }, sub1: { 'CA-BC': 'British Columbia', 'FR-973': 'French Guiana' } }
const codes = (xs: ListEntry[]) => xs.map((x) => x.code)
const label = (k: string) => k
const top = (counts: ReturnType<typeof placeCounts>) => placeRows(counts, undefined, label).map((o) => [o.value, o.count, o.children])

describe('continents in matching', () => {
  it('a continent matches the species seen in any country on it', () => {
    expect(codes(applyFilter(list, { continents: ['AF'] }, species))).toEqual(['crow', 'wren'])
    expect(codes(applyFilter(list, { continents: ['AF', 'OC'] }, species))).toEqual(['crow', 'wren', 'finch'])
  })

  it('is one OR set with the other place levels, and ANDs with the other filters', () => {
    expect(codes(applyFilter(list, { continents: ['AF'], countries: ['CA'] }, species))).toEqual(['duck', 'owl', 'crow', 'wren'])
    expect(codes(applyFilter(list, { continents: ['AF'], order: 'Passeriformes' }, species))).toEqual(['crow', 'wren'])
    expect(codes(applyFilter(list, { continents: ['AF'], order: 'Anseriformes' }, species))).toEqual([])
  })

  it('uses the seen-here places: a species seen in an African country matches, its lifer place does not', () => {
    const recs = [{ code: 'duck', source: 'ebird' as const, date: '2019-05-01', place: { country: 'CA' }, seen: ['2019-05-01|CA', '2021-01-01|TZ'] }]
    const seen = buildSeen(recs, { added: [], removed: [], marks: {} } as never, { researchOnly: false } as never, [list[0]])
    expect(codes(applyFilter([list[0]], { continents: ['AF'] }, species, seen))).toEqual(['duck'])
  })
})

describe('ancestry: a continent holds its countries, provinces and counties', () => {
  it('ticking Africa then Kenya leaves only Kenya', () => {
    expect(togglePlace(togglePlace({}, 'n:AF'), 'c:KE')).toEqual({ countries: ['KE'] })
  })

  it('ticking Africa while Kenya (or a Kenyan county) is ticked leaves only Africa', () => {
    expect(togglePlace({ countries: ['KE'] }, 'n:AF')).toEqual({ continents: ['AF'] })
    expect(togglePlace({ countries: ['KE', 'CA'] }, 'n:AF')).toEqual({ continents: ['AF'], countries: ['CA'] })
    expect(togglePlace({ countries: ['KE'], provinces: ['CA-BC'] }, 'n:AF')).toEqual({ continents: ['AF'], provinces: ['CA-BC'] })
    expect(togglePlace({ countries: ['CA'], provinces: ['CA-BC'], counties: ['CA-BC|Capital'] }, 'n:NA')).toEqual({ continents: ['NA'] })
  })

  it('unticking, order and toggling a second continent', () => {
    expect(togglePlace({ continents: ['AF'] }, 'n:AF')).toEqual({})
    expect(togglePlace({ continents: ['OC'] }, 'n:AF')).toEqual({ continents: ['AF', 'OC'] })
    expect(withPlaces({}, ['n:OC', 'n:AF', 'n:AF', 'n:XX'])).toEqual({ continents: ['AF', 'OC'] })
  })

  it('a country under a ticked continent is covered by it', () => {
    expect(withPlaces({}, ['n:AF', 'c:KE', 's:KE-30'])).toEqual({ continents: ['AF'] })
  })

  it('hasPlaces, filtersCount, clearPlaces and filterKey see continents', () => {
    expect(hasPlaces({ continents: ['AF'] })).toBe(true)
    expect(filtersCount({ continents: ['AF'], countries: ['CA'], statuses: ['VU'] })).toBe(2)
    expect(clearPlaces({ countries: ['CA'], continents: ['AF'], order: 'Anseriformes' })).toEqual({ order: 'Anseriformes' })
    expect(filterKey({ continents: ['AF', 'EU'], countries: ['CA'] })).toBe('c:CA|t:AF,EU')
    expect(filterPlaceKeys({ continents: ['AF'], countries: ['CA'], provinces: ['CA-BC'] })).toEqual(['n:AF', 'c:CA', 's:CA-BC'])
  })
})

describe('the continent level of the counts', () => {
  it('the top level: continents with their species and their countries, by count', () => {
    expect(top(placeCounts(list, {}, species))).toEqual([['n:AF', 2, 2], ['n:NA', 2, 1], ['n:OC', 1, 1]])
    expect(placeRows(placeCounts(list, {}, species), 'n:AF', label).map((o) => [o.value, o.count])).toEqual([['c:EG', 1], ['c:KE', 1]])
  })

  it('each species counts once per continent, whatever countries it was seen in there', () => {
    const recs = [{ code: 'duck', source: 'ebird' as const, date: '2019-05-01', place: { country: 'KE' }, seen: ['2019-05-01|KE', '2020-05-01|TZ'] }]
    const seen = buildSeen(recs, { added: [], removed: [], marks: {} } as never, { researchOnly: false } as never, [list[0]])
    const c = placeCounts([list[0]], {}, species, seen)
    expect(top(c)).toEqual([['n:AF', 1, 2]])
    expect(placeRows(c, 'n:AF', label).map((o) => [o.value, o.count])).toEqual([['c:KE', 1], ['c:TZ', 1]])
  })

  it('counts under the other filters: the order, and a Time range', () => {
    expect(top(placeCounts(list, { order: 'Anseriformes' }, species))).toEqual([['n:NA', 1, 1]])
    // Lifers 2021-05 and 2022-05 (crow, wren) are Africa's: only they are in 2021-01..2022-12.
    expect(top(placeCounts(list, { from: '2021-01', to: '2022-12' }, species))).toEqual([['n:AF', 2, 2]])
    expect(top(placeCounts(list, { from: '2023-01' }, species))).toEqual([['n:OC', 1, 1]])
  })

  it('the counts ignore the checked places, so a checkbox changes no row', () => {
    expect(top(placeCounts(list, { continents: ['AF'] }, species))).toEqual(top(placeCounts(list, {}, species)))
  })

  it('onlyOneContinent: one continent and none checked; else the level stays', () => {
    const na = [list[0], list[1]]
    expect(onlyOneContinent(placeCounts(na, {}, species), {})).toBe(true)
    expect(onlyOneContinent(placeCounts(na, {}, species), { continents: ['NA'] })).toBe(false)
    expect(onlyOneContinent(placeCounts(list, {}, species), {})).toBe(false)
    expect(onlyOneContinent(placeCounts(list, { order: 'Anseriformes' }, species), { order: 'Anseriformes' })).toBe(true)
    expect(countryRows(placeCounts(na, {}, species), label).map((o) => o.value)).toEqual(['c:CA'])
  })
})

describe('a country in no continent', () => {
  it('is listed at the top beside the continents, as a country, and matches by its own key; nothing crashes', () => {
    const l = [...list, e('duck', 'ZZ')].slice(1) // owl CA, crow EG, wren KE, finch AU, duck ZZ
    const c = placeCounts(l, {}, species)
    expect(top(c)).toEqual([['n:AF', 2, 2], ['c:ZZ', 1, 0], ['n:NA', 1, 1], ['n:OC', 1, 1]])
    expect(onlyOneContinent(placeCounts([e('duck', 'ZZ')], {}, species), {})).toBe(false)
    expect(codes(applyFilter(l, { countries: ['ZZ'] }, species))).toEqual(['duck'])
  })
})

describe('overseas regions take their parent country\'s continent', () => {
  // owl seen in France (Île-de-France) and in French Guiana; wren only in French Guiana; crow in France without a region.
  const recs = [
    { code: 'owl', source: 'inat' as const, date: '2020-01-01', place: { country: 'FR', sub1: 'FR-IDF' }, seen: ['2020-01-01|FR-IDF', '2021-01-01|FR-973'] },
    { code: 'wren', source: 'inat' as const, date: '2021-01-01', place: { country: 'FR', sub1: 'FR-973' }, seen: ['2021-01-01|FR-973'] },
    { code: 'crow', source: 'inat' as const, date: '2022-01-01', place: { country: 'FR' }, seen: ['2022-01-01|FR'] },
  ]
  const l = ['owl', 'wren', 'crow'].map((c, i) => list.find((x) => x.code === c) ?? list[i])
  const seen = buildSeen(recs, { added: [], removed: [], marks: {} } as never, { researchOnly: false } as never, l)

  it('France is under Europe and under South America, each with its own count', () => {
    const c = placeCounts(l, {}, species, seen)
    expect(top(c)).toEqual([['n:EU', 2, 1], ['n:SA', 2, 1]])
    expect(placeRows(c, 'n:EU', label).map((o) => [o.value, o.count, o.children])).toEqual([['c:FR', 2, 1]])
    expect(placeRows(c, 'n:SA', label).map((o) => [o.value, o.count, o.children])).toEqual([['c:FR@SA', 2, 1]])
    expect(placeRows(c, 'c:FR@SA', label).map((o) => [o.value, o.count])).toEqual([['s:FR-973', 2]])
    expect(placeRows(c, 'c:FR', label).map((o) => [o.value, o.count])).toEqual([['s:FR-IDF', 1]])
  })

  it('France under Europe filters only European France', () => {
    expect(codes(applyFilter(l, { countries: ['FR'] }, species, seen))).toEqual(['owl', 'crow'])
    expect(codes(applyFilter(l, { countries: ['FR@SA'] }, species, seen))).toEqual(['owl', 'wren'])
    expect(codes(applyFilter(l, { continents: ['SA'] }, species, seen))).toEqual(['owl', 'wren'])
    expect(codes(applyFilter(l, { provinces: ['FR-973'] }, species, seen))).toEqual(['owl', 'wren'])
  })

  it('ancestry follows the overseas chain: South America holds France\'s part there, Europe does not', () => {
    expect(togglePlace({ countries: ['FR@SA'] }, 'n:SA')).toEqual({ continents: ['SA'] })
    expect(togglePlace({ provinces: ['FR-973'] }, 'n:SA')).toEqual({ continents: ['SA'] })
    expect(togglePlace({ provinces: ['FR-973'] }, 'n:EU')).toEqual({ continents: ['EU'], provinces: ['FR-973'] })
    expect(togglePlace({ countries: ['FR'] }, 'c:FR@SA')).toEqual({ countries: ['FR', 'FR@SA'] })
  })
})

describe('filterToShow and validation', () => {
  it('filterToShow keeps a continent that holds the bird and clears the places when nothing does', () => {
    expect(filterToShow({ continents: ['AF'] }, list[2], species)).toEqual({ continents: ['AF'] })
    expect(filterToShow({ continents: ['AF'], countries: ['CA'] }, list[0], species)).toEqual({ continents: ['AF'], countries: ['CA'] })
    expect(filterToShow({ continents: ['AF'], countries: ['CA'] }, list[4], species)).toEqual({})
  })

  it('validation drops unknown ids and duplicates, keeps the rest in order, and never keeps an empty list', () => {
    expect(applyFilterValidity({ continents: ['OC', 'AF', 'AF', 'ZZ'] as never }, list, species, false)).toEqual({ continents: ['AF', 'OC'] })
    expect(applyFilterValidity({ continents: ['ZZ'] as never }, list, species, false)).toEqual({})
    expect(applyFilterValidity({ continents: ['AF'], countries: ['KE'] }, list, species, false)).toEqual({ continents: ['AF'] })
  })

  it('a list change (pruneValues) drops a continent no species was seen in; without it the continent stays', () => {
    expect(applyFilterValidity({ continents: ['SA'] }, list, species, true)).toEqual({})
    expect(applyFilterValidity({ continents: ['SA'] }, list, species, false)).toEqual({ continents: ['SA'] })
    expect(applyFilterValidity({ continents: ['AF'] }, list, species, true)).toEqual({ continents: ['AF'] })
  })
})

describe('chips and labels', () => {
  it('"Africa" is a place chip, first, and removes only that continent', () => {
    const f: Filter = { continents: ['AF'], countries: ['CA'] }
    const chips = filterChips(f, regions)
    expect(chips.map((c) => [c.label, c.token])).toEqual([['Africa', 'n:AF'], ['Canada', 'c:CA']])
    expect(withoutFilterChip(f, chips[0])).toEqual({ countries: ['CA'] })
    expect(withoutFilterChip(f, chips[1])).toEqual({ continents: ['AF'] })
  })

  it('continents count toward the three-chip rule as places', () => {
    const f: Filter = { continents: ['AF', 'OC'], countries: ['CA', 'EG'] }
    const [collapsed] = filterChips(f, regions)
    expect(collapsed).toEqual({ kind: 'place', label: '4 places', token: ALL, spoken: placesSpoken(f, regions) })
    expect(withoutFilterChip(f, collapsed)).toEqual({})
    expect(filterChips({ continents: ['AF'], countries: ['CA', 'EG'] }, regions)).toHaveLength(3)
  })

  it('the Places label names continents first ("Africa + Kenya"); the spoken name lists them by name', () => {
    expect(placesLabel({ continents: ['AF'], countries: ['KE'] }, regions)).toBe('Africa + Kenya')
    expect(placesLabel({ continents: ['AF', 'EU', 'OC'], countries: ['CA'] }, regions)).toBe('Africa and 3 more')
    expect(placesLabel({ countries: ['FR@SA'] }, regions)).toBe('France (South America)')
    expect(placesLabel({ countries: ['FR', 'FR@SA'] }, regions)).toBe('France + France (South America)')
    expect(placesLabel({ countries: ['CA', 'CA'] }, regions)).toBe('Canada')
    expect(placesSpoken({ countries: ['FR', 'FR@SA'] }, regions)).toBe('France, France (South America)')
    expect(filterChips({ countries: ['FR', 'FR@SA'] }, regions).map((c) => [c.label, c.spoken])).toEqual([['France', 'France'], ['France (South America)', 'France (South America)']])
    expect(placesSpoken({ continents: ['AF'], countries: ['EG', 'KE'] }, regions)).toBe('Africa; Egypt, Kenya')
    expect(placesSpoken({ continents: ['AF'] }, regions)).toBe('Africa')
    expect(filtersSpoken({ continents: ['AF'] }, regions)).toBe('Places: Africa')
  })

  it('the share image label reads continents first, with or without the regions', () => {
    const ctx = { species, countryName: (c: string) => regions.countries[c] ?? c }
    expect(filterLabel({ continents: ['AF'], countries: ['KE'] }, { ...ctx, regions })).toBe('Africa + Kenya')
    expect(filterLabel({ continents: ['AF'], countries: ['KE'] }, ctx)).toBe('Africa + Kenya')
    expect(filterLabel({ countries: ['FR@SA'] }, ctx)).toBe('France')
    expect(filterLabel({ continents: ['OC'] }, ctx)).toBe('Oceania')
  })
})
