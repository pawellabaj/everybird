import { describe, expect, it } from 'vitest'
import { makeSub1Index, SUB1_ALIASES } from '@/lib/import/sub1-index'
import { makeObsOrgPlaces, OBSORG_SUB1_ALIASES } from '@/lib/import/obsorg-places'
import { makePlaceResolver } from '@/lib/import/inat'
import { foldName } from '@/lib/species/resolve'
import { regions } from './obsorg-helpers'

/** iNaturalist's resolver over one country and one sub1 name. */
const inatPlace = (country: string, sub1: string) =>
  makePlaceResolver(regions, new Map([[1, { id: 1, name: country, admin_level: 0 }], [2, { id: 2, name: sub1, admin_level: 10 }]]))([1, 2])

describe('the shared sub1 name index', () => {
  it('an alias wins over a real name: Washington is the state, Murcia and Valencia the communities', () => {
    const sub1 = makeSub1Index(regions)
    expect(sub1('US', 'Washington')).toBe('US-WA')
    expect(sub1('US', 'District of Columbia')).toBe('US-DC')
    expect(sub1('ES', 'La Rioja')).toBe('ES-RI')
    expect(sub1('ES', 'Murcia')).toBe('ES-MC')
    expect(sub1('ES', 'Valencia')).toBe('ES-VC')
    expect(sub1('CN', 'Yunnan')).toBe('CN-53')
    expect(sub1('AR', 'Buenos Aires')).toBe('AR-B')
    // Both importers read the same index.
    expect(inatPlace('United States', 'Washington')).toEqual({ country: 'US', sub1: 'US-WA' })
    expect(inatPlace('Spain', 'Murcia')).toEqual({ country: 'ES', sub1: 'ES-MC' })
    expect(makeObsOrgPlaces(regions)('Verenigde Staten', 'Washington')).toEqual({ country: 'US', sub1: 'US-WA' })
    expect(makeObsOrgPlaces(regions)('Spanje', 'Valencia')).toEqual({ country: 'ES', sub1: 'ES-VC' })
  })
  it('a name two codes claim, with no alias, is the country only', () => {
    expect(regions.sub1['BG-22']).toBe('Sofia')
    expect(regions.sub1['BG-23']).toBe('Sofia')
    expect(makeSub1Index(regions)('BG', 'Sofia')).toBeUndefined()
    expect(inatPlace('Bulgaria', 'Sofia')).toEqual({ country: 'BG' })
    expect(makeObsOrgPlaces(regions)('Bulgarije', 'Sofia')).toEqual({ country: 'BG' })
    // Three or more claimants stay dead too (a third claim must not revive the name).
    const r = { v: 1 as const, countries: { AA: 'A' }, sub1: { 'AA-1': 'Twin', 'AA-2': 'Twin', 'AA-3': 'Twin', 'AA-4': 'Solo [Alone]' } }
    const sub1 = makeSub1Index(r, [])
    expect(sub1('AA', 'Twin')).toBeUndefined()
    expect(sub1('AA', 'Solo')).toBe('AA-4')
    expect(sub1('AA', 'Alone')).toBe('AA-4')
    expect(sub1('BB', 'Solo')).toBeUndefined()
    expect(makeSub1Index(r, [{ 'AA-2': ['Twin'] }])('AA', 'Twin')).toBe('AA-2')
  })
  it('no alias name points at two codes in one country, and every alias names a real code', () => {
    const seen = new Map<string, string>()
    for (const table of [SUB1_ALIASES, OBSORG_SUB1_ALIASES]) {
      for (const [code, names] of Object.entries(table)) {
        expect(regions.sub1[code], code).toBeDefined()
        for (const name of names) {
          const k = `${code.split('-')[0]}|${foldName(name)}`
          expect(seen.get(k) ?? code, k).toBe(code)
          seen.set(k, code)
        }
      }
    }
  })
})
