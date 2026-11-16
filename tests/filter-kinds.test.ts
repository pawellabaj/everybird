import { describe, expect, it } from 'vitest'
import { newlySetKinds } from '@/lib/list/filter-kinds'

describe('newlySetKinds', () => {
  it('names a kind that goes from empty to set', () => {
    expect(newlySetKinds({}, { countries: ['CA'] })).toEqual(['place'])
    expect(newlySetKinds({}, { provinces: ['CA-BC'] })).toEqual(['place'])
    expect(newlySetKinds({}, { counties: ['CA-BC|Capital'] })).toEqual(['place'])
    expect(newlySetKinds({}, { continents: ['europe' as never] })).toEqual(['continent'])
    expect(newlySetKinds({}, { from: '2024-01' })).toEqual(['time'])
    expect(newlySetKinds({}, { to: '2024-06' })).toEqual(['time'])
    expect(newlySetKinds({}, { year: '2024' })).toEqual(['time'])
    expect(newlySetKinds({}, { statuses: ['VU' as never] })).toEqual(['status'])
    expect(newlySetKinds({}, { group: 'waterfowl' })).toEqual(['group'])
    expect(newlySetKinds({}, { order: 'Passeriformes' })).toEqual(['taxonomy'])
    expect(newlySetKinds({ order: 'Passeriformes' }, { order: 'Passeriformes', family: 'Corvidae' })).toEqual(['taxonomy'])
  })
  it('names a kind changed to another non-empty value', () => {
    expect(newlySetKinds({ countries: ['CA'] }, { countries: ['CA', 'US'] })).toEqual(['place'])
    expect(newlySetKinds({ from: '2020-01' }, { from: '2021-01' })).toEqual(['time'])
  })
  it('ignores clearing, no change, order within a set, and the basis alone', () => {
    expect(newlySetKinds({ countries: ['CA'], order: 'X' }, {})).toEqual([])
    expect(newlySetKinds({ countries: ['CA', 'US'] }, { countries: ['US', 'CA'] })).toEqual([])
    expect(newlySetKinds({ countries: [] }, { countries: [] })).toEqual([])
    expect(newlySetKinds({}, { basis: 'seen' })).toEqual([])
  })
  it('reports several kinds at once (a smart search)', () => {
    expect(newlySetKinds({}, { group: 'owls', countries: ['MX'], from: '2024-01' }).sort()).toEqual(['group', 'place', 'time'])
  })
})
