import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { capFirst, familyNames, mergeChain } from '../scripts/build-data/build-names'
import { assertSameSpeciesCodes, taxonomyUrl } from '../scripts/build-data/fetch-sources'
import { DATA_FILE_NAMES } from '../scripts/build-data/data-files'
import { DATA_FILES } from '../src/lib/data-files'
import { familyLang, NAME_BASE, NAME_LOCALES, REGION_LOCALE } from '../src/lib/species/name-locales'
import type { SpeciesFile } from '../src/lib/species/types'

const english = new Map([['amerob', 'American Robin'], ['kea', 'Kea']])
const es = new Map([['amerob', 'Zorzal robín'], ['kea', 'Kea']])
const read = (name: string) => readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8')

describe('names fallback chains', () => {
  it('a partial regional set falls back to the base, not English', () => {
    expect(mergeChain(english, [new Map([['amerob', 'American Robin']]), es])).toEqual({ amerob: 'Zorzal robín' })
  })

  it('a regional name wins where it is real', () => {
    expect(mergeChain(english, [new Map([['amerob', 'Zorzal regional']]), es])).toEqual({ amerob: 'Zorzal regional' })
  })

  it('a name equal to English is left out, as are blank names and unknown codes', () => {
    expect(mergeChain(english, [new Map([['kea', 'Kea'], ['amerob', ' '], ['extra', 'Otro']])])).toEqual({})
  })

  it('pt_PT falls back to pt_BR', () => {
    expect(NAME_BASE.pt_PT).toBe('pt_BR')
    expect(mergeChain(english, [new Map([['amerob', 'American Robin']]), new Map([['amerob', 'Tordo-americano']])])).toEqual({ amerob: 'Tordo-americano' })
  })

  it('pt_BR names start with a capital and keep the rest', () => {
    expect(capFirst('tordo-americano', 'pt-BR')).toBe('Tordo-americano')
    expect(capFirst('sabiá-laranjeira', 'pt-BR')).toBe('Sabiá-laranjeira')
    expect(capFirst('águia-d’África', 'pt-BR')).toBe('Águia-d’África')
    expect(capFirst('', 'pt-BR')).toBe('')
  })

  it('family names: hand file, then exact group, else English', () => {
    const species = [
      { fam: 'Aidae', famCom: 'First birds' }, { fam: 'Bidae', famCom: 'Second birds' },
      { fam: 'Cidae', famCom: 'Third birds' }, { fam: 'Didae', famCom: 'Fourth birds' },
    ]
    expect(familyNames([
      { englishName: 'First birds', groupName: 'Grupo uno' },
      { englishName: 'Second birds', groupName: 'Grupo dos' },
      { englishName: 'Third birds and others', groupName: 'Grupo tres' },
      { englishName: 'Fourth birds', groupName: 'Fourth birds' },
    ], species, { Aidae: 'Manual' })).toEqual({ Aidae: 'Manual', Bidae: 'Grupo dos' })
  })

  it('sorts name and family keys deterministically', () => {
    expect(Object.keys(mergeChain(new Map([['z', 'Z'], ['a', 'A']]), [new Map([['z', 'Zeta'], ['a', 'Alfa']])]))).toEqual(['a', 'z'])
    expect(Object.keys(familyNames([], [{ fam: 'Z', famCom: 'Z' }, { fam: 'A', famCom: 'A' }], { Z: 'Zeta', A: 'Alfa' }))).toEqual(['A', 'Z'])
  })
})

describe('name locales and pinned source data', () => {
  it('includes every planned locale and maps regions and family languages', () => {
    expect(NAME_LOCALES).toEqual(['es', 'es_MX', 'es_EC', 'es_PY', 'es_UY', 'es_BO', 'es_PE', 'es_CR', 'es_VE', 'es_AR', 'es_PA', 'es_HN', 'es_CL', 'es_CU', 'es_PR', 'es_DO', 'pt_BR', 'pt_PT', 'nl'])
    expect(REGION_LOCALE).toMatchObject({ ES: 'es', MX: 'es_MX', PT: 'pt_PT', BR: 'pt_BR', NL: 'nl', BE: 'nl' })
    for (const l of NAME_LOCALES) {
      expect(NAME_BASE[l]).toBe(l.startsWith('es') ? 'es' : l.startsWith('pt') ? 'pt_BR' : 'nl')
      expect(familyLang(l)).toBe(l.startsWith('es') ? 'es' : l.startsWith('pt') ? 'pt' : 'nl')
    }
  })

  it('pins taxonomy requests and fetches Dutch as nl_NL', () => {
    const url = new URL(taxonomyUrl('2026', 'nl'))
    expect(url.origin).toBe('https://api.ebird.org')
    expect(Object.fromEntries(url.searchParams)).toEqual({ fmt: 'json', cat: 'species', locale: 'nl_NL', version: '2026' })
    expect(new URL(taxonomyUrl('2025', 'es_AR')).searchParams.get('version')).toBe('2025')
  })

  it('refuses a locale whose species codes differ from English, including duplicates', () => {
    const en = [{ speciesCode: 'a', category: 'species' }, { speciesCode: 'b', category: 'species' }, { speciesCode: 'form', category: 'issf' }]
    expect(() => assertSameSpeciesCodes(en, en.slice(0, 2), 'es')).not.toThrow()
    expect(() => assertSameSpeciesCodes(en, [{ speciesCode: 'a' }, { speciesCode: 'c' }], 'es')).toThrow(/es.*species codes/i)
    expect(() => assertSameSpeciesCodes(en, [{ speciesCode: 'a' }, { speciesCode: 'b' }, { speciesCode: 'b' }], 'nl')).toThrow(/nl.*species codes/i)
  })
})

describe('committed names files', () => {
  it('the committed files cover the species file', () => {
    const species = JSON.parse(read('species.v1.json')) as SpeciesFile
    const codes = new Set(species.species.map((s) => s.code))
    const common = new Map(species.species.map((s) => [s.code, s.com]))
    const families = [...new Set(species.species.map((s) => s.fam))].sort()
    for (const l of NAME_LOCALES) {
      const file = JSON.parse(read(`names.${l}.v1.json`))
      expect(file).toMatchObject({ v: 1, locale: l, taxonomy: species.ebirdTaxonomy })
      expect(Object.keys(file.names).sort()).toEqual(Object.keys(file.names))
      expect(Object.keys(file.fam).sort()).toEqual(Object.keys(file.fam))
      for (const [code, name] of Object.entries(file.names)) {
        expect(codes.has(code), `${l}: ${code}`).toBe(true)
        expect(typeof name).toBe('string')
        expect(name).not.toBe(common.get(code))
      }
      expect(Object.keys(file.fam)).toEqual(families)
      if (l === 'es' || l === 'nl') expect(Object.keys(file.names).length).toBeGreaterThanOrEqual(11100)
    }
    expect(gzipSync(read('names.es.v1.json'), { level: 9 }).length).toBeLessThan(110_000)
  })

  it('every NAME_LOCALES entry has a data file and a DATA_FILES entry', () => {
    for (const l of NAME_LOCALES) {
      const name = `names.${l}.v1.json`
      expect(DATA_FILE_NAMES).toContain(name)
      expect(Object.keys(DATA_FILES)).toContain(name)
      expect(() => JSON.parse(read(name))).not.toThrow()
    }
  })
})
