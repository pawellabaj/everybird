import { describe, expect, it } from 'vitest'
import { countryName, regionsIn } from '@/lib/i18n-places'
import type { Regions } from '@/lib/species/types'

const regions: Regions = { v: 1, countries: { CA: 'Canada', KR: 'Korea [South]', XX: 'Nowhere Land' }, sub1: { 'CA-BC': 'British Columbia' } }

describe('countryName', () => {
  it('Intl.DisplayNames in the language', () => {
    expect(countryName('CA', 'es', regions)).toBe('Canadá')
    expect(countryName('CA', 'nl', regions)).toBe('Canada')
  })
  it("English is always the regions' name (brackets stripped), never Intl", () => {
    expect(countryName('CA', 'en', regions)).toBe('Canada')
    expect(countryName('KR', 'en', regions)).toBe('Korea')
  })
  it("a code the engine doesn't know, or a malformed one, falls back to the regions' name, else the code", () => {
    expect(countryName('XX', 'es', regions)).toBe('Nowhere Land')
    expect(countryName('not-a-code', 'pt', { countries: { 'not-a-code': 'Odd' } })).toBe('Odd')
    expect(countryName('QQ', 'es', { countries: {} })).toBe('QQ')
  })
})

describe('regionsIn', () => {
  it('English returns the regions themselves; another language renames the countries only, once', () => {
    expect(regionsIn(regions, 'en')).toBe(regions)
    const es = regionsIn(regions, 'es')
    expect(es.countries.CA).toBe('Canadá')
    expect(es.sub1).toEqual(regions.sub1)
    expect(regionsIn(regions, 'es')).toBe(es)
    expect(regions.countries.CA).toBe('Canada')
  })
})
