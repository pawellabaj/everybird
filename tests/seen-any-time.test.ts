// Item 9 bug-check fixes: "Seen any time" counts every kind of sighting (a month set, a place's earliest date, the
// lifer), the Time drag's preview follows the same rule, and the basis only exists with a range.
import { describe, expect, it } from 'vitest'
import { stillView } from '@/components/app/use-collage-layout'
import { buildList } from '@/lib/list/build-list'
import { applyFilter, filterKey, filterToShow, placeCounts, seenBasis } from '@/lib/list/filters'
import { applyFilterValidity } from '@/lib/list/filters-validate'
import { DEFAULT_RULES, EMPTY_EDITS, type ListEntry, type SourceRecord } from '@/lib/list/model'
import { SeenAgg, buildSeen, hasSeenMonths } from '@/lib/list/seen'
import { candidateOrds, entryInFilter, makeWhere, ordsIn, sightingIn } from '@/lib/list/sighting'
import type { SpeciesIndex } from '@/lib/species/load'

const row = (code: string) => ({ code, com: code, sci: code, ord: 'Gaviiformes', fam: 'Gaviidae', famCom: 'Loons', to: 1 }) as never
const rows = [row('loon'), row('owl'), row('wren')]
const species: SpeciesIndex = { rows, byCode: new Map(rows.map((r) => [(r as { code: string }).code, r])), search: () => [] }

// loon: an eBird life list lifer in BC on 2019-03-15 (no month sets), and iNaturalist months in BC in 2021-07.
function inat(code: string, key: string, months: string[]): SourceRecord {
  const agg = new SeenAgg()
  agg.addMonths(code, key, months)
  agg.addKey(code, key, months[0])
  return { code, source: 'inat', date: months[0] + '-01', place: { country: 'CA', sub1: 'CA-BC' }, seen: agg.get(code), seenMonths: agg.getMonths(code) }
}
const records: SourceRecord[] = [
  { code: 'loon', source: 'ebird', date: '2019-03-15', place: { country: 'CA', sub1: 'CA-BC' } },
  inat('loon', 'CA-BC', ['2021-07']),
  // wren: a by-hand tick dated by year only, in Egypt
  { code: 'wren', source: 'manual', date: '2018', place: { country: 'EG' } },
  // owl: months from one source in Kenya; its lifer is a life-list row in Egypt in 2015-02-02
  { code: 'owl', source: 'ebird', date: '2015-02-02', place: { country: 'EG' } },
  inat('owl', 'KE', ['2022-05']),
]
const list = buildList(records, EMPTY_EDITS, DEFAULT_RULES)
const seen = buildSeen(records, EMPTY_EDITS, DEFAULT_RULES, list)
const codes = (f: object) => applyFilter(list, f, species, seen).map((e) => e.code).sort()
const entry = (code: string) => list.find((e) => e.code === code) as ListEntry
const BC = { provinces: ['CA-BC'] }

describe('"Seen any time" counts the lifer, a place\'s earliest date and the month sets', () => {
  it('the loon is in for 2019 (its life-list lifer) and for 2021 (iNaturalist\'s months), out for 2020', () => {
    expect(codes({ ...BC, from: '2019-01', to: '2019-12', basis: 'seen' })).toEqual(['loon'])
    expect(codes({ ...BC, from: '2021-01', to: '2021-12', basis: 'seen' })).toEqual(['loon'])
    expect(codes({ ...BC, from: '2020-01', to: '2020-12', basis: 'seen' })).toEqual([])
  })
  it('under the lifer basis only the lifer date counts', () => {
    expect(codes({ ...BC, from: '2019-01', to: '2019-12' })).toEqual(['loon'])
    expect(codes({ ...BC, from: '2021-01', to: '2021-12' })).toEqual([])
  })
  it('a range alone: any sighting anywhere; a year-only tick matches its year', () => {
    expect(codes({ from: '2018-01', to: '2018-12', basis: 'seen' })).toEqual(['wren'])
    expect(codes({ from: '2015-01', to: '2015-12', basis: 'seen' })).toEqual(['owl'])
    expect(codes({ from: '2022-05', to: '2022-05', basis: 'seen' })).toEqual(['owl'])
  })
  it('the place and the period must meet in one sighting', () => {
    expect(codes({ countries: ['EG'], from: '2022-01', to: '2022-12', basis: 'seen' })).toEqual([])
    expect(codes({ countries: ['KE'], from: '2022-01', to: '2022-12', basis: 'seen' })).toEqual(['owl'])
    expect(codes({ countries: ['EG'], from: '2015-01', to: '2015-12', basis: 'seen' })).toEqual(['owl'])
  })
  it('the Places counts count only the places seen in the period', () => {
    const c = placeCounts(list, { from: '2022-01', to: '2022-12', basis: 'seen' }, species, seen)
    expect([...c.countries.keys()]).toEqual(['KE'])
    const d = placeCounts(list, { from: '2019-01', to: '2019-12', basis: 'seen' }, species, seen)
    expect([...d.countries.keys()]).toEqual(['CA'])
  })
  it('filterToShow keeps the range for a bird seen in it by any evidence', () => {
    const f = { from: '2019-01', to: '2019-12', basis: 'seen' as const }
    expect(filterToShow(f, entry('loon'), species, seen)).toEqual(f)
    expect(filterToShow({ ...f, from: '2020-01', to: '2020-12' }, entry('loon'), species, seen)).toEqual({ basis: 'seen' })
  })
  it('a pruned range survives when the lifer alone is in it', () => {
    const f = { from: '2019-01', to: '2019-12', basis: 'seen' as const }
    expect(applyFilterValidity(f, [entry('loon')], species, true, seen)).toEqual(f)
  })
  it('the card line shows the earliest sighting inside the filter, the lifer\'s full date when it is the one', () => {
    expect(sightingIn(entry('loon'), { ...BC, from: '2019-01', to: '2019-12', basis: 'seen' }, seen)).toEqual({ date: '2019-03-15', place: { country: 'CA', sub1: 'CA-BC' } })
    expect(sightingIn(entry('loon'), { ...BC, from: '2021-01', to: '2021-12', basis: 'seen' }, seen)).toEqual({ date: '2021-07', place: { country: 'CA', sub1: 'CA-BC' } })
    expect(sightingIn(entry('owl'), { countries: ['KE'] }, seen)?.date).toBe('2022-05')
    expect(entryInFilter(entry('loon'), { ...BC, from: '2019-01', to: '2019-12' }, seen)).toBe(entry('loon'))
    expect(sightingIn(entry('loon'), {}, seen)).toBeUndefined()
  })
  it('without a seen index the lifer stands for itself', () => {
    expect(applyFilter(list, { ...BC, from: '2019-01', to: '2019-12', basis: 'seen' }, species).map((e) => e.code)).toEqual(['loon'])
  })
})

describe('the basis only exists with a range (B3)', () => {
  it('has no key and no effect with places alone', () => {
    expect(seenBasis({ basis: 'seen', countries: ['CA'] })).toBe(false)
    expect(filterKey({ countries: ['CA'], basis: 'seen' })).toBe('c:CA')
    expect(filterKey({ countries: ['CA'], from: '2021-01', basis: 'seen' })).toBe('c:CA|r:2021-01~|b:seen')
  })
})

describe('the Time drag\'s preview follows the seen rule (B2)', () => {
  const box: [number, number, number, number] = [0, 0, 1, 1]
  const layout = { key: 'wide|even|', layout: 'wide' as const, mode: 'even' as const, W: 10, H: 10, scale: 1, base: 1, boxes: new Map([['loon', box], ['owl', box], ['wren', box]]) }
  const full = { layout, visible: new Set(['loon', 'owl', 'wren']) }
  const dates = new Map(list.map((e) => [e.code, e.date]))

  it('precomputed month ordinals inside the places, then a binary search', () => {
    const w = makeWhere(['s:CA-BC'], [])
    const ords = new Map(list.map((e) => [e.code, candidateOrds(e, seen, w)]))
    expect(ords.get('owl')).toEqual([])
    expect(ords.get('loon')).toEqual([2019 * 12 + 2, 2021 * 12 + 6])
    expect(ordsIn(ords.get('loon')!, '2019-01', '2019-12')).toBe(true)
    expect(ordsIn(ords.get('loon')!, '2020-01', '2020-12')).toBe(false)
    expect([...stillView(full, '', { dates, ords, from: '2021-01', to: '2021-12' }).visible]).toEqual(['loon'])
    expect([...stillView(full, '', { dates, ords, from: '2019-01', to: '2019-12' }).visible]).toEqual(['loon'])
  })
  it('a year-only date covers its twelve months, and without places any sighting counts', () => {
    const ords = new Map(list.map((e) => [e.code, candidateOrds(e, seen, makeWhere([], []))]))
    expect(ords.get('wren')).toHaveLength(12)
    expect([...stillView(full, '', { dates, ords, from: '2018-06', to: '2018-06' }).visible]).toEqual(['wren'])
    expect([...stillView(full, '', { dates, ords, from: '2022-01', to: '2022-12' }).visible]).toEqual(['owl'])
  })
  it('without ordinals (the lifer basis) the lifer dates decide, as before', () => {
    expect([...stillView(full, '', { dates, from: '2021-01', to: '2021-12' }).visible]).toEqual([])
  })
})

describe('one "has months" check (D4)', () => {
  it('is true when any species has month sets', () => {
    expect(hasSeenMonths(seen)).toBe(true)
    const none = buildSeen([records[0], records[2]], EMPTY_EDITS, DEFAULT_RULES, buildList([records[0], records[2]], EMPTY_EDITS, DEFAULT_RULES))
    expect(hasSeenMonths(none)).toBe(false)
    expect(hasSeenMonths(undefined)).toBe(false)
  })
})
