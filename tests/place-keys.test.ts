import { describe, expect, it } from 'vitest'
import { childKey, isWithin, keysOfPlace, parentKey, parsePlaceKey, placeName, placeNameLong } from '@/lib/list/place-keys'

describe('place keys', () => {
  it('every place gives its keys at each level it has', () => {
    expect(keysOfPlace({ country: 'CA', sub1: 'CA-BC', sub2: 'Capital' })).toEqual(['c:CA', 's:CA-BC', 'k:CA-BC|Capital'])
    expect(keysOfPlace({ country: 'CA', sub1: 'CA-BC' })).toEqual(['c:CA', 's:CA-BC'])
    expect(keysOfPlace({ country: 'KE', sub2: 'Some county' })).toEqual(['c:KE']) // a county without a province counts at the country
  })

  it('parses the three levels and refuses anything else', () => {
    expect(parsePlaceKey('c:CA')).toEqual({ level: 'country', country: 'CA' })
    expect(parsePlaceKey('k:US-OR|Washington')).toEqual({ level: 'county', country: 'US', sub1: 'US-OR', county: 'Washington' })
    expect(parsePlaceKey('s:CA-share0')).toEqual({ level: 'province', country: 'CA', sub1: 'CA-share0' })
    for (const bad of ['', 'c:ca', 's:CA', 'k:CA-BC|', 'k:CA|X', 'x:CA']) expect(parsePlaceKey(bad)).toBeUndefined()
  })

  it('parents and children; same-named counties in two states stay apart', () => {
    expect(parentKey('k:US-OR|Washington')).toBe('s:US-OR')
    expect(parentKey('s:US-OR')).toBe('c:US')
    expect(parentKey('c:US')).toBeUndefined()
    expect(isWithin('k:US-OR|Washington', 'c:US')).toBe(true)
    expect(isWithin('k:US-OR|Washington', 's:US-OR')).toBe(true)
    expect(isWithin('s:US-OR', 'c:US')).toBe(true)
    expect(isWithin('k:US-OR|Washington', 's:US-PA')).toBe(false)
    expect(isWithin('k:US-PA|Washington', 'k:US-OR|Washington')).toBe(false)
    expect(isWithin('c:US', 'c:US')).toBe(false)
    expect(isWithin('c:US', 's:US-OR')).toBe(false)
    expect(childKey({ country: 'US', sub1: 'US-PA', sub2: 'Washington' }, undefined)).toBe('c:US')
    expect(childKey({ country: 'US', sub1: 'US-PA', sub2: 'Washington' }, 'c:US')).toBe('s:US-PA')
    expect(childKey({ country: 'US', sub1: 'US-PA', sub2: 'Washington' }, 's:US-PA')).toBe('k:US-PA|Washington')
    expect(childKey({ country: 'US', sub1: 'US-PA', sub2: 'Washington' }, 's:US-OR')).toBeUndefined()
    expect(childKey({ country: 'US', sub1: 'US-PA' }, 's:US-PA')).toBeUndefined()
    expect(childKey({ country: 'US' }, 'c:US')).toBeUndefined()
    expect(childKey({ country: 'CA', sub1: 'CA-BC' }, 'c:US')).toBeUndefined()
    expect(childKey({ country: 'US', sub1: 'US-PA', sub2: 'Washington' }, 'k:US-PA|Washington')).toBeUndefined()
  })

  it('names: short and long', () => {
    const regions = { countries: { CA: 'Canada', GB: 'United Kingdom [GB]' }, sub1: { 'CA-BC': 'British Columbia', 'GB-WLS': 'Wales [Cymru GB-CYM]' } }
    expect(placeName('c:CA', regions)).toBe('Canada')
    expect(placeName('c:GB', regions)).toBe('United Kingdom')
    expect(placeName('c:ZZ', regions)).toBe('ZZ')
    expect(placeName('s:CA-BC', regions)).toBe('British Columbia')
    expect(placeName('s:GB-WLS', regions)).toBe('Wales')
    expect(placeName('s:CA-XX', regions)).toBe('CA-XX')
    expect(placeName('k:CA-BC|Capital', regions)).toBe('Capital')
    expect(placeNameLong('c:CA', regions)).toBe('Canada')
    expect(placeNameLong('s:CA-BC', regions)).toBe('British Columbia, Canada')
    expect(placeNameLong('k:CA-BC|Capital', regions)).toBe('Capital, British Columbia')
  })
})
