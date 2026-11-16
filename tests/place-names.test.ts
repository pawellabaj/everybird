import { describe, expect, it } from 'vitest'
import { countryNameMap, makeSub1Index, sub1Names } from '@/lib/places/names'
import type { Regions } from '@/lib/species/types'

const regions: Regions = { v: 1, countries: { US: 'United States of America', MX: 'Mexico', NL: 'Netherlands', GB: 'United Kingdom' },
  sub1: { 'CA-BC': 'British Columbia', 'XX-A': 'Shared', 'XX-B': 'Shared', 'ES-CT': 'Catalunya [Cataluña]' } }

describe('shared item 8 place-name resolution', () => {
  it('adds current-language Intl country names, English, and explicit aliases', () => {
    expect(countryNameMap(regions, ['en', 'es']).get('mexico')).toBe('MX')
    expect(countryNameMap(regions, ['en', 'nl']).get('nederland')).toBe('NL')
    expect(countryNameMap(regions).get('usa')).toBe('US')
    expect(countryNameMap(regions).get('uk')).toBe('GB')
  })
  it('never guesses between countries with the same folded name', () => {
    expect(countryNameMap({ ...regions, countries: { AA: 'Shared', BB: 'Shared' } }, []).has('shared')).toBe(false)
  })
  it('mirrors item 8 sub1 collisions, explicit alias precedence, country scoping and bracketed names', () => {
    const sub1 = makeSub1Index(regions, [{ 'XX-A': ['Known alias'] }])
    expect(sub1('XX', 'Shared')).toBeUndefined()
    expect(sub1('XX', 'Known alias')).toBe('XX-A')
    expect(sub1('CA', 'Known alias')).toBeUndefined()
    expect(sub1('ES', 'Cataluña')).toBe('ES-CT')
    expect(sub1Names('Wales [Cymru GB-CYM]')).toEqual(['wales', 'cymru'])
    const preferred = makeSub1Index(regions, [{ 'XX-A': ['Shared'] }, { 'XX-B': ['Shared'] }])
    expect(preferred('XX', 'Shared')).toBe('XX-A')
  })
})
