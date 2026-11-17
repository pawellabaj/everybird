// @vitest-environment jsdom
// Body-mass precedence in buildSpecies: override, AVONET, BIRDBASE (measured); genus, family, order (estimated).
// Synthetic names only.
import { describe, expect, it } from 'vitest'
import type { BirdbaseRow } from '../scripts/build-data/birdbase'
import { buildSpecies, genusOf } from '../scripts/build-data/build-species'
import { massLabel, massValue } from '../src/components/collage/BirdCard'
import { en } from '../src/i18n/messages/en'
import { es } from '../src/i18n/messages/es'
import type { HuashuRecord, Overrides, SpeciesRow, TaxonRow } from '../src/lib/species/types'

const rec = (id: string, sci: string, ebird: string, massG?: number): HuashuRecord => ({
  id, scientificName: sci, taxonConcept: 'same', taxonomy: { seq: 1, order: 'Ordo', family: 'Famone' }, ids: { ebird },
  ...(massG === undefined ? {} : { traits: { massG } }),
})
const tx = (code: string, sci: string, to: number, fam = 'Famone', ord = 'Ordo'): TaxonRow =>
  ({ code, sci, com: `Common ${code}`, cat: 'species', to, ord, fam, famCom: 'Family' })
const bb = (sci: string, massG: number): BirdbaseRow =>
  ({ id: sci, english: `Bird ${sci}`, sci: { birdlife: sci, hbw: sci, ioc: sci, ebird: sci, avilist: sci }, massG })
function build(taxa: TaxonRow[], huashu: HuashuRecord[], overrides: Overrides = {}, birdbase: BirdbaseRow[] = []) {
  const { file, report } = buildSpecies(huashu, taxa, overrides, {}, birdbase)
  return { rows: new Map<string, SpeciesRow>(file.species.map((r) => [r.code, r])), report }
}

describe('body mass precedence', () => {
  // ovr: override 5 beats AVONET 10 and BIRDBASE 20. avo: AVONET 10 beats BIRDBASE 20. bbo: BIRDBASE alone.
  const taxa = [tx('ovr', 'Alpha ovr', 1), tx('avo', 'Alpha avo', 2), tx('bbo', 'Alpha bbo', 3), tx('gen', 'Alpha gen', 4)]
  const huashu = [rec('Alpha_ovr', 'Alpha ovr', 'ovr', 10), rec('Alpha_avo', 'Alpha avo', 'avo', 10)]
  const birdbase = [bb('Alpha ovr', 20), bb('Alpha avo', 20), bb('Alpha bbo', 20)]
  const { rows, report } = build(taxa, huashu, { ovr: { massG: 5, source: 'synthetic' } }, birdbase)

  it('override, then AVONET, then BIRDBASE, each for the species it has', () => {
    expect(rows.get('ovr')).toMatchObject({ g: 5, gSrc: 'override' })
    expect(rows.get('avo')).toMatchObject({ g: 10, gSrc: 'avonet' })
    expect(rows.get('bbo')).toMatchObject({ g: 20, gSrc: 'birdbase' })
  })

  it('a species with no measured mass takes the genus median of the measured masses in its genus', () => {
    // Alpha's measured masses: 5 (override), 10 (AVONET), 20 (BIRDBASE): median 10
    expect(rows.get('gen')).toMatchObject({ g: 10, gSrc: 'genus' })
  })

  it('the report counts each source', () => {
    expect(report).toContain('- Mass sources: avonet 1, override 1, birdbase 1, genus 1, family 0, order 0')
    expect(report).toContain('- BIRDBASE masses by scientific name: 1; by English name: 0')
  })
})

describe('genus median', () => {
  it('is the median of an even number of masses, from BIRDBASE as well as AVONET', () => {
    const { rows } = build(
      [tx('d1', 'Delta one', 1), tx('d2', 'Delta two', 2), tx('d3', 'Delta three', 3)],
      [rec('Delta_one', 'Delta one', 'd1', 4)],
      {},
      [bb('Delta two', 8)],
    )
    expect(rows.get('d3')).toMatchObject({ g: 6, gSrc: 'genus' })
  })

  it('needs at least one measured species in the genus; otherwise the family median', () => {
    const { rows } = build(
      [tx('x1', 'Xeno one', 1), tx('x2', 'Yara two', 2), tx('x3', 'Xeno three', 3), tx('x4', 'Zeta four', 4)],
      [rec('Xeno_one', 'Xeno one', 'x1', 10), rec('Yara_two', 'Yara two', 'x2', 100)],
    )
    expect(rows.get('x3')).toMatchObject({ g: 10, gSrc: 'genus' })
    expect(rows.get('x4')).toMatchObject({ g: 55, gSrc: 'family' })
  })

  it('an estimate never feeds the family pool: x4 gets the median of the measured masses only', () => {
    // Measured in Famone: 10 (Xeno one) and 100 (Yara two). Xeno three's genus estimate (10) must not join them,
    // or the family median would be 10 instead of 55.
    const { rows } = build(
      [tx('x1', 'Xeno one', 1), tx('x2', 'Yara two', 2), tx('x3', 'Xeno three', 3), tx('x4', 'Zeta four', 4)],
      [rec('Xeno_one', 'Xeno one', 'x1', 10), rec('Yara_two', 'Yara two', 'x2', 100)],
    )
    expect(rows.get('x3')).toMatchObject({ gSrc: 'genus' })
    expect(rows.get('x4')!.g).toBe(55)
  })

  it('the genus is the first word of the scientific name', () => {
    expect(genusOf('Patagona gigas')).toBe('Patagona')
    expect(genusOf('Ptilinopus holosericeus')).toBe('Ptilinopus')
  })
})

describe('mass labels on the card', () => {
  const row = (gSrc: SpeciesRow['gSrc']): SpeciesRow => ({
    code: 'x', com: 'X', sci: 'Genus x', ord: 'O', fam: 'F', famCom: 'F', to: 1, g: 4.3, gSrc, st: true, ar: 1, q: true,
  })

  it('a genus estimate says so and is marked "~", like the family and order estimates', () => {
    expect(massLabel(row('genus'), en.ui)).toBe('Average body mass, estimated from its genus')
    expect(massLabel(row('genus'), es.ui)).toBe(es.ui.card.massGenus)
    expect(massValue(row('genus'), en.ui)).toMatch(/^~/)
    expect(massValue(row('family'), en.ui)).toMatch(/^~/)
    expect(massValue(row('order'), en.ui)).toMatch(/^~/)
  })

  it('measured masses (BIRDBASE, AVONET, override) are not marked', () => {
    for (const s of ['birdbase', 'avonet', 'override'] as const) {
      expect(massLabel(row(s), en.ui)).toBe(en.ui.card.mass)
      expect(massValue(row(s), en.ui)).not.toMatch(/^~/)
    }
  })
})
