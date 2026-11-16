// The continent table (src/lib/places/continents.ts) against the regions file, and the continent helpers.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTINENTS, CONTINENT_OF, continentName, isContinentId } from '@/lib/places/continents'

const regions = JSON.parse(readFileSync('public/data/regions.v1.json', 'utf8')) as { countries: Record<string, string> }
const IDS = CONTINENTS.map((c) => c.id)

describe('continent table', () => {
  it('every country code in regions.v1.json has exactly one continent', () => {
    for (const iso of Object.keys(regions.countries)) {
      expect(Object.hasOwn(CONTINENT_OF, iso), iso).toBe(true)
      expect(IDS, iso).toContain(CONTINENT_OF[iso])
    }
  })

  it('no table entry is a code absent from regions.v1.json', () => {
    for (const iso of Object.keys(CONTINENT_OF)) expect(regions.countries, iso).toHaveProperty([iso])
  })

  it('the calls the brief names land where the brief puts them', () => {
    expect(CONTINENT_OF.RU).toBe('EU')
    for (const iso of ['TR', 'CY', 'GE', 'AM', 'AZ']) expect(CONTINENT_OF[iso], iso).toBe('AS')
    expect(CONTINENT_OF.EG).toBe('AF')
    for (const iso of ['GL', 'PR', 'CR', 'PA', 'JM']) expect(CONTINENT_OF[iso], iso).toBe('NA')
    expect(CONTINENT_OF.FK).toBe('SA')
    for (const iso of ['AU', 'NZ', 'FJ', 'PF']) expect(CONTINENT_OF[iso], iso).toBe('OC')
    for (const iso of ['HM', 'TF', 'GS']) expect(CONTINENT_OF[iso], iso).toBe('AN')
  })

  it('lists the seven continents in display order, with English names', () => {
    expect(CONTINENTS.map((c) => c.name)).toEqual(['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'])
    expect(continentName('NA')).toBe('North America')
    expect(continentName('XX')).toBe('XX')
  })

  it('isContinentId accepts only the seven ids', () => {
    expect(isContinentId('AF')).toBe(true)
    expect(isContinentId('af')).toBe(false)
    expect(isContinentId('XX')).toBe(false)
    expect(isContinentId(undefined)).toBe(false)
  })
})
