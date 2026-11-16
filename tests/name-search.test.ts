import { EN_UI } from '@/i18n/messages/en-ui'
import { afterEach, describe, expect, it } from 'vitest'
import type { ListEntry } from '@/lib/list/model'
import { buildSpeciesIndex } from '@/lib/species/load'
import { nameTier, searchCollage, searchKey } from '@/lib/species/name-search'
import { setEnglishNames, setNames } from '@/lib/species/names'
import type { SpeciesRow } from '@/lib/species/types'

const sp = (code: string, com: string, sci: string, ord: string, to: number): SpeciesRow =>
  ({ code, com, sci, ord, fam: `${ord}idae`, famCom: ord, to, g: 10, gSrc: 'avonet', st: true, ar: 1, q: true }) as SpeciesRow
const rows = [
  sp('comeid', 'Common Eider', 'Somateria mollissima', 'Anseriformes', 1),
  sp('norfli', 'Northern Flicker', 'Colaptes auratus', 'Piciformes', 2),
  sp('gilfli', 'Gilded Flicker', 'Colaptes chrysoides', 'Piciformes', 3),
  sp('amerob', 'American Robin', 'Turdus migratorius', 'Passeriformes', 4),
  sp('rufhum', "Rufous Hummingbird", 'Selasphorus rufus', 'Apodiformes', 5),
  sp('bkcchi', 'Black-capped Chickadee', 'Poecile atricapillus', 'Passeriformes', 6),
]
const species = buildSpeciesIndex(rows)
const entry = (code: string): ListEntry => ({ code, heard: false, dead: false, media: false, sources: [] })

describe('name search (shared with species.search)', () => {
  it('matches word prefixes of the common or scientific name, accent- and case-insensitive', () => {
    const t = (q: string, code: string) => nameTier(searchKey(q), species.byCode.get(code)!)
    expect(t('flick', 'norfli')).toBeGreaterThanOrEqual(0)
    expect(t('nor fl', 'norfli')).toBeGreaterThanOrEqual(0)
    expect(t('colap aur', 'norfli')).toBeGreaterThanOrEqual(0)
    expect(t('ÉIDER', 'comeid')).toBeGreaterThanOrEqual(0)
    expect(t('capped', 'bkcchi')).toBeGreaterThanOrEqual(0) // "Black-capped": hyphens split words
    expect(t('licker', 'norfli')).toBe(-1) // not a word prefix
    expect(t('robin', 'norfli')).toBe(-1)
  })

  it('species.search still ranks exact names, then common, then scientific prefixes', () => {
    expect(species.search('colaptes').map((r) => r.code)).toEqual(['norfli', 'gilfli'])
    expect(species.search('american robin')[0].code).toBe('amerob')
  })
})

describe('searchCollage (the dock search: orders, families and species among the birds on show)', () => {
  const fam = (code: string, com: string, sci: string, ord: string, famSci: string, famCom: string, to: number): SpeciesRow =>
    ({ code, com, sci, ord, fam: famSci, famCom, to, g: 10, gSrc: 'avonet', st: true, ar: 1, q: true }) as SpeciesRow
  const rows2 = [
    fam('ostric2', 'Common Ostrich', 'Struthio camelus', 'Struthioniformes', 'Struthionidae', 'Ostriches', 1),
    fam('norfli', 'Northern Flicker', 'Colaptes auratus', 'Piciformes', 'Picidae', 'Woodpeckers', 2),
    fam('gilfli', 'Gilded Flicker', 'Colaptes chrysoides', 'Piciformes', 'Picidae', 'Woodpeckers', 3),
    fam('emptou1', 'Emerald Toucanet', 'Aulacorhynchus prasinus', 'Piciformes', 'Ramphastidae', 'Toucans', 4),
    fam('amerob', 'American Robin', 'Turdus migratorius', 'Passeriformes', 'Turdidae', 'Thrushes', 5),
    fam('wooth', 'Wood Thrush', 'Hylocichla mustelina', 'Passeriformes', 'Turdidae', 'Thrushes', 6),
  ]
  const sp2 = buildSpeciesIndex(rows2)
  const all = rows2.map((r) => entry(r.code))
  const hits = (q: string, es = all, limit?: number) => searchCollage(es, q, sp2, { limit, t: EN_UI }).map((h) => `${h.kind}:${h.com}:${h.count}`)

  it('finds species, families and orders by common or scientific word prefixes, sorted by common name', () => {
    expect(hits('thrush')).toEqual(['family:Thrushes:2', 'species:Wood Thrush:1'])
    expect(hits('wood')).toEqual(['species:Wood Thrush:1', 'order:Woodpeckers:3', 'family:Woodpeckers:2'])
    expect(hits('colaptes')).toEqual(['species:Gilded Flicker:1', 'species:Northern Flicker:1'])
    expect(hits('piciformes')).toEqual(['order:Woodpeckers:3'])
    expect(hits('turdidae')).toEqual(['family:Thrushes:2'])
  })

  it('reads "Common name (scientific)": each hit carries both names and what picking it sets', () => {
    expect(searchCollage(all, 'toucan', sp2, { t: EN_UI })).toEqual([
      { kind: 'species', value: 'emptou1', com: 'Emerald Toucanet', sci: 'Aulacorhynchus prasinus', count: 1, order: 'Piciformes', inFilter: true },
      { kind: 'family', value: 'Ramphastidae', com: 'Toucans', sci: 'Ramphastidae', count: 1, order: 'Piciformes', inFilter: true },
    ])
  })

  it('covers the whole list: matches in the current filter first, then the rest, each sorted by name', () => {
    const picids = new Set(['norfli', 'gilfli'])
    const r = searchCollage(all, 'wood', sp2, { shown: picids, t: EN_UI })
    expect(r.map((h) => `${h.kind}:${h.com}:${h.count}:${h.inFilter}`)).toEqual([
      'order:Woodpeckers:2:true', // counted in the filter
      'family:Woodpeckers:2:true',
      'species:Wood Thrush:1:false', // outside the filter, after it
    ])
    expect(searchCollage(all, 'thrush', sp2, { shown: picids, t: EN_UI }).every((h) => !h.inFilter)).toBe(true)
    // An order only partly in the filter is in it; its count is the filter's.
    expect(searchCollage(all, 'piciformes', sp2, { shown: new Set(['norfli']), t: EN_UI })).toMatchObject([{ kind: 'order', count: 1, inFilter: true }])
  })

  it("drops a family that is its order's only family under the same name", () => {
    expect(hits('ostrich')).toEqual(['species:Common Ostrich:1', 'order:Ostriches:1'])
  })

  it('an empty query finds nothing; a capped search keeps the best matches, still sorted by name', () => {
    expect(hits('   ')).toEqual([])
    expect(hits('t', all, 2)).toEqual(['family:Thrushes:2', 'family:Toucans:1'])
  })
})

describe('local names in search', () => {
  const set = { v: 1 as const, locale: 'es' as const, taxonomy: 't', names: { amerob: 'Zorzal americano', comeid: 'Eider común', norfli: 'Espátula' }, fam: {} }
  afterEach(() => { setNames(null); setEnglishNames(false) })

  it('finds a bird by its Spanish or its English name', () => {
    setNames(set)
    const find = (q: string) => species.search(q, 10).map((r) => r.code)
    expect(find('zorzal')).toContain('amerob')
    expect(find('robin')).toContain('amerob')
    expect(find('americano')).toContain('amerob')
    expect(find('american')).toContain('amerob')
  })
  it('folds accents: "espatula" finds "Espátula"', () => {
    setNames(set)
    expect(species.search('espatula', 5).map((r) => r.code)).toEqual(['norfli'])
    expect(species.search('comun', 5).map((r) => r.code)).toEqual(['comeid'])
  })
  it('a stale cache is rebuilt when the names change', () => {
    expect(species.search('zorzal', 5)).toEqual([]) // computed (and cached) with no names
    setNames(set)
    expect(species.search('zorzal', 5).map((r) => r.code)).toEqual(['amerob'])
    setNames(null)
    expect(species.search('zorzal', 5)).toEqual([])
  })
  it('an exact local name outranks a prefix match; hits carry the display name', () => {
    setNames({ ...set, names: { ...set.names, rufhum: 'Zorzal' } })
    expect(species.search('zorzal', 5).map((r) => r.code)).toEqual(['rufhum', 'amerob'])
    const hits = searchCollage(rows.map((r) => entry(r.code)), 'zorzal', species, { lang: 'es', t: EN_UI })
    expect(hits.map((h) => h.com)).toEqual(['Zorzal', 'Zorzal americano'])
  })
  it('the English switch drops local names from display and search (English still matches)', () => {
    setEnglishNames(true) // no localStorage in node: kept in memory
    setNames(set)
    expect(searchCollage([entry('amerob')], 'robin', species, { lang: 'es', t: EN_UI })[0].com).toBe('American Robin')
    expect(species.search('zorzal', 5)).toEqual([])
  })
})
