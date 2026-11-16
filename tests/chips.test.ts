import { describe, expect, it } from 'vitest'
import { ALL, filterChips, withoutFilterChip } from '@/lib/list/chips'
import { filtersCount, placesSpoken } from '@/lib/list/filter-summary'
import type { Filter } from '@/lib/list/filters'

const r = { countries: { CA: 'Canada', EG: 'Egypt', KE: 'Kenya', PE: 'Peru' }, sub1: { 'CA-BC': 'British Columbia' } }

describe('filterChips', () => {
  it('one chip per place up to three, in filterPlaceKeys order, short names spoken with their parent', () => {
    expect(filterChips({ countries: ['EG'], provinces: ['CA-BC'] }, r)).toEqual([
      { kind: 'place', label: 'Egypt', token: 'c:EG', spoken: 'Egypt' },
      { kind: 'place', label: 'British Columbia', token: 's:CA-BC', spoken: 'British Columbia, Canada' },
    ])
    expect(filterChips({ countries: ['CA', 'EG', 'KE'] }, r)).toHaveLength(3)
  })

  it('four or more places collapse to one "N places" chip', () => {
    const f: Filter = { countries: ['CA', 'EG', 'KE', 'PE'] }
    expect(filterChips(f, r)).toEqual([{ kind: 'place', label: '4 places', token: ALL, spoken: placesSpoken(f, r) }])
  })

  it('time is always one chip, worded by timeSummary and spoken in full', () => {
    expect(filterChips({ from: '2022-01', to: '2024-12' }, r)).toEqual([
      { kind: 'date', label: '2022–2024', token: '2022-01..2024-12', spoken: 'January 2022 to December 2024' },
    ])
    const from = filterChips({ from: '2022-01' }, r)[0]
    expect(from.label).toBe('from 2022')
    expect(from.token).toBe('2022-01..')
    expect(filterChips({ from: '2021-09', to: '2021-09' }, r)[0].label).toBe('Sep 2021')
  })

  it('spec 12: 7 places, a range and Endangered', () => {
    const f: Filter = { countries: ['CA', 'EG', 'KE', 'PE', 'US', 'MX', 'BR'], from: '2022-01', to: '2024-12', statuses: ['EN'] }
    expect(filterChips(f, r).map((c) => c.label)).toEqual(['7 places', '2022–2024', 'Endangered'])
    expect(filtersCount(f)).toBe(3)
  })

  it('statuses: one chip each up to three in Red List order, then "N statuses"', () => {
    expect(filterChips({ statuses: ['VU', 'EN', 'CR'] }, r).map((c) => c.label)).toEqual(['Vulnerable', 'Endangered', 'Critically Endangered'])
    expect(filterChips({ statuses: ['LC', 'NT', 'VU', 'EN'] }, r)).toEqual([{ kind: 'status', label: '4 statuses', token: ALL }])
    expect(filterChips({ statuses: ['VU', 'NE'] }, r).map((c) => c.label)).toEqual(['Vulnerable', 'Not evaluated'])
    expect(withoutFilterChip({ statuses: ['VU', 'NE'] }, { kind: 'status', label: 'Not evaluated', token: 'NE' })).toEqual({ statuses: ['VU'] })
  })

  it('order: places, time, statuses; none for taxonomy or an empty filter', () => {
    expect(filterChips({ order: 'Strigiformes' }, r)).toEqual([])
    const kinds = filterChips({ statuses: ['VU'], from: '2020-01', countries: ['CA'] }, r).map((c) => c.kind)
    expect(kinds).toEqual(['place', 'date', 'status'])
  })
})

describe('withoutFilterChip', () => {
  it('removes exactly what the chip stands for', () => {
    const rm = (f: Filter, i: number) => withoutFilterChip(f, filterChips(f, r)[i])
    expect(rm({ countries: ['EG', 'CA'] }, 1)).toEqual({ countries: ['EG'] })
    const big: Filter = { countries: ['CA'], provinces: ['US-WA'], counties: ['CA-BC|Capital'], order: 'Strigiformes' }
    // A single key leaves the others alone (a county under a province checked elsewhere stays).
    expect(withoutFilterChip(big, { kind: 'place', label: 'x', token: 's:US-WA' })).toEqual({ countries: ['CA'], order: 'Strigiformes' })
    expect(withoutFilterChip(big, { kind: 'place', label: '3 places', token: ALL })).toEqual({ order: 'Strigiformes' })
    expect(rm({ from: '2020-03', to: '2021-06', countries: ['CA'] }, 1)).toEqual({ countries: ['CA'] })
    expect(rm({ statuses: ['VU', 'EN'] }, 0)).toEqual({ statuses: ['EN'] })
    expect(withoutFilterChip({ statuses: ['LC', 'NT', 'VU', 'EN'] }, { kind: 'status', label: '4 statuses', token: ALL })).toEqual({})
    const f: Filter = { order: 'X' }
    expect(withoutFilterChip(f, { kind: 'group', label: 'g', token: 'g' })).toBe(f)
  })
})
