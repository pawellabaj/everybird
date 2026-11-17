// BIRDBASE name matching, the committed extract, and the built species data it produced (no network, no xlsx).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BIRDBASE_CSV, BIRDBASE_DOI, indexBirdbase, loadBirdbase, matchBirdbase, parseBirdbase, type BirdbaseIndex,
} from '../scripts/build-data/birdbase'
import type { SpeciesFile } from '../src/lib/species/types'

const HEADER = 'species_id,english_name,latin_birdlife_first,hbw_birdlife,ioc_15_1,ebird_clements_2024b,avilist_v1_2025,average_mass_g'
// Synthetic names. Row 3's IOC name is row 5's BirdLife name, to test that the column order beats the row order.
const CSV = [
  HEADER,
  '1,Alpha Bird,Alpha one,Alpha one,Alpha one,Alpha one,Alpha one,10.5',
  '2,"Beta, Bird",Beta two,Beta two,Gamma three,Gamma three,Gamma three,20',
  '3,Kappa Bird,Kappa x,Kappa x,Kappa y,Kappa x,Kappa x,30.25',
  '4,Lambda Bird,Lambda five,Lambda five,Lambda five,Lambda five,Lambda five,40',
  '5,Kappa Two,Kappa y,Kappa y,Kappa y,Kappa y,Kappa y,50',
].join('\n')

describe('parseBirdbase', () => {
  it('reads the columns, a quoted comma in a name, and the mass as a number', () => {
    const rows = parseBirdbase(CSV)
    expect(rows).toHaveLength(5)
    expect(rows[1]).toEqual({
      id: '2', english: 'Beta, Bird',
      sci: { birdlife: 'Beta two', hbw: 'Beta two', ioc: 'Gamma three', ebird: 'Gamma three', avilist: 'Gamma three' },
      massG: 20,
    })
  })

  it('refuses a row without a positive mass', () => {
    expect(() => parseBirdbase(CSV.replace('10.5', '0'))).toThrow(/mass/)
    expect(() => parseBirdbase(CSV.replace('10.5', ''))).toThrow(/mass/)
  })
})

describe('matchBirdbase', () => {
  const index: BirdbaseIndex = indexBirdbase(parseBirdbase(CSV))
  const id = (m: ReturnType<typeof matchBirdbase>) => m?.row.id

  it('matches a scientific name against the BirdLife column first', () => {
    expect(matchBirdbase(index, 'Alpha one', 'No such English')).toMatchObject({ by: 'scientific', column: 'birdlife' })
    expect(id(matchBirdbase(index, 'Alpha one', ''))).toBe('1')
  })

  it('is case-insensitive', () => {
    expect(id(matchBirdbase(index, '  ALPHA ONE ', ''))).toBe('1')
    expect(id(matchBirdbase(index, 'gamma THREE', ''))).toBe('2')
  })

  it('tries the columns in order: BirdLife, HBW, IOC, eBird, AviList', () => {
    expect(matchBirdbase(index, 'Gamma three', '')).toMatchObject({ by: 'scientific', column: 'ioc' })
  })

  it('a BirdLife-column hit on a later row beats an earlier row whose IOC name is the same string', () => {
    // Query "Kappa y": row 3 has it in IOC (earlier in the file), row 5 has it in BirdLife. Row 5 wins.
    expect(id(matchBirdbase(index, 'Kappa y', ''))).toBe('5')
    expect(id(matchBirdbase(index, 'Kappa x', ''))).toBe('3')
  })

  it('falls back to the English name, case-insensitively, when no name column matches', () => {
    expect(matchBirdbase(index, 'Unknown sp', 'beta, BIRD')).toEqual({ row: index.english.get('beta, bird'), by: 'english' })
    expect(id(matchBirdbase(index, 'Unknown sp', 'Lambda Bird'))).toBe('4')
  })

  it('returns nothing when neither the scientific nor the English name is in the extract', () => {
    expect(matchBirdbase(index, 'Unknown sp', 'Unknown bird')).toBeUndefined()
  })

  it('a name on two rows keeps the first (sheet order), so the match is deterministic', () => {
    const twice = indexBirdbase(parseBirdbase(CSV + '\n6,Alpha Copy,Alpha one,Alpha one,Alpha one,Alpha one,Alpha one,99'))
    expect(id(matchBirdbase(twice, 'Alpha one', ''))).toBe('1')
  })
})

describe('the committed extract', () => {
  const rows = loadBirdbase(process.cwd())

  it('is data/raw/birdbase/birdbase-mass.csv: one row per BIRDBASE species that has a mass (10,582)', () => {
    expect(BIRDBASE_CSV).toBe('data/raw/birdbase/birdbase-mass.csv')
    expect(rows).toHaveLength(10582)
    expect(rows[0]).toMatchObject({ id: '1', english: 'Common Ostrich', massG: 114500 })
    expect(rows.every((r) => r.massG > 0)).toBe(true)
  })

  it('names the paper: the DOI is the one the About page links', () => {
    expect(BIRDBASE_DOI).toBe('10.1038/s41597-025-05615-3')
  })
})

describe('the built species data', () => {
  const species = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/species.v1.json'), 'utf8')) as SpeciesFile
  const index = indexBirdbase(loadBirdbase(process.cwd()))

  it('a species with gSrc birdbase has its BIRDBASE mass; no other estimate has a BIRDBASE row', () => {
    for (const r of species.species) {
      if (r.gSrc === 'avonet' || r.gSrc === 'override') continue
      const m = matchBirdbase(index, r.sci, r.com)
      if (r.gSrc === 'birdbase') expect(m?.row.massG, r.code).toBe(r.g)
      else expect(m, `${r.code} (${r.gSrc}) would have a BIRDBASE mass`).toBeUndefined()
    }
  })

  it('Patagona peruviana (giahum2) is 20.2 g from the override, the Southern Giant-Hummingbird value', () => {
    const r = species.species.find((s) => s.code === 'giahum2')!
    expect(r).toMatchObject({ sci: 'Patagona peruviana', g: 20.2, gSrc: 'override' })
    expect(r.g).toBe(species.species.find((s) => s.code === 'giahum3')!.g)
  })
})
