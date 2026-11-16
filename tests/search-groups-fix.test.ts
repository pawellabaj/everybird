// Item 9 bug-check fixes: the group chip's matching, the shared groups fetch, the sample's groups, and a group dropping
// an order or family outside it.
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { applySmart } from '@/lib/search/apply'
import { parseSmart, type SearchContext } from '@/lib/search/smart'
import type { GroupsFile, SearchLang } from '@/lib/search/groups'
import { buildSpeciesIndex } from '@/lib/species/load'

const groupsFile: GroupsFile = JSON.parse(readFileSync('public/data/groups.v1.json', 'utf8'))
const calls: string[] = []
vi.mock('@/lib/data-url', () => ({
  fetchData: vi.fn(async (name: string) => {
    calls.push(name)
    if (name === 'groups.v1.json') return groupsFile
    throw new Error(`unexpected ${name}`)
  }),
}))

const ctx: SearchContext = {
  today: new Date(2026, 10, 15, 12), lang: 'en', groups: groupsFile.groups,
  regions: { v: 1, countries: { CA: 'Canada', US: 'United States of America' }, sub1: { 'CA-BC': 'British Columbia', 'US-TN': 'Tennessee' } },
  listPlaces: ['c:CA', 's:CA-BC', 'c:US', 's:US-TN'],
}
const parse = (q: string, lang: SearchLang = 'en') => parseSmart(q, { ...ctx, lang })

describe('a group needs its whole name or synonym, not a word of it', () => {
  it('the words of a bird name never make a group of their own', () => {
    // Only the whole-word synonym "heron" / "warbler" may (it is a group's own word), never "great", "blue" or "black".
    expect(parse('great blue heron').filter.group).toBe('herons-ibis-and-allies')
    expect(parse('black-throated blue warbler').filter.group).toBe('wood-warblers')
    expect(parse('american robin').filter.group).toBeUndefined()
  })
  it.each(['great blue', 'black-throated blue', 'american robin', 'common', 'great', 'blue', 'greater', 'lesser', 'little', 'black', 'american'])('"%s" is no group', (q) => {
    expect(parse(q).filter.group).toBeUndefined()
  })
  it.each([
    ['en', 'herons', 'herons-ibis-and-allies'], ['en', 'warblers', 'wood-warblers'], ['en', 'owls', 'owls'], ['en', 'ducks', 'waterfowl'],
    ['en', 'Herons, Ibis, and Allies', 'herons-ibis-and-allies'],
    ['es', 'garzas', 'herons-ibis-and-allies'], ['pt', 'corujas', 'owls'], ['nl', 'uilen', 'owls'],
    ['es', 'patos', 'waterfowl'], ['nl', 'eenden', 'waterfowl'], ['pt', 'garças', 'herons-ibis-and-allies'], ['nl', 'reigers', 'herons-ibis-and-allies'],
  ] as const)('%s "%s" is the %s group', (lang, q, id) => {
    expect(parse(q, lang).filter.group).toBe(id)
  })
  it('a part of a multi-word name is no group', () => {
    expect(parse('tyrant flycatchers').filter.group).toBeUndefined()
    expect(parse('new zealand').filter.group).toBeUndefined()
  })
  it('hawks BC reads the capitals as the province; lowercase bc is a word left for bird names', () => {
    expect(parse('hawks BC').filter).toEqual({ group: 'vultures-hawks-and-allies', provinces: ['CA-BC'] })
    expect(parse('hawks bc').filter.provinces).toBeUndefined()
    expect(parse('hawks bc').rest).toBe('bc')
  })
})

describe('applying a group drops an order or family outside it (D3)', () => {
  const sp = (code: string, ord: string, fam: string, to: number) => ({ code, com: code, sci: code, ord, fam, famCom: fam, to, g: 10, gSrc: 'avonet', st: true, ar: 1, q: true }) as never
  const index = {
    ...buildSpeciesIndex([sp('a', 'Anseriformes', 'Anatidae', 5), sp('b', 'Passeriformes', 'Turdidae', 500), sp('c', 'Mixed', 'F1', 500), sp('d', 'Mixed', 'F2', 8)]),
    groups: new Map([['waterfowl', { id: 'waterfowl', name: { en: 'Waterfowl', es: '', pt: '', nl: '' }, lo: 1, hi: 10 }]]),
  }
  const kinds = new Set(['group'] as const)
  it('drops an order with nothing inside the group, and its family', () => {
    expect(applySmart({ order: 'Passeriformes', family: 'Turdidae' }, { group: 'waterfowl' }, kinds, index)).toEqual({ group: 'waterfowl' })
  })
  it('drops only the family when the order reaches into the group', () => {
    expect(applySmart({ order: 'Mixed', family: 'F1' }, { group: 'waterfowl' }, kinds, index)).toEqual({ order: 'Mixed', group: 'waterfowl' })
    expect(applySmart({ order: 'Mixed', family: 'F2' }, { group: 'waterfowl' }, kinds, index)).toEqual({ order: 'Mixed', family: 'F2', group: 'waterfowl' })
  })
  it('keeps what is inside the group, and everything without a groups file', () => {
    expect(applySmart({ order: 'Anseriformes', family: 'Anatidae' }, { group: 'waterfowl' }, kinds, index)).toEqual({ order: 'Anseriformes', family: 'Anatidae', group: 'waterfowl' })
    expect(applySmart({ order: 'Passeriformes' }, { group: 'waterfowl' }, kinds)).toEqual({ order: 'Passeriformes', group: 'waterfowl' })
  })
})

describe('the groups file is fetched once and the sample has its groups (D2)', () => {
  it('shares one fetch between the species index and the sample, and puts groups in the sample\'s index', async () => {
    const { loadGroupMap } = await import('@/lib/species/load')
    const { fromPackFile } = await import('@/lib/list/sample-pack')
    const [a, b] = await Promise.all([loadGroupMap(), loadGroupMap()])
    expect(a).toBe(b)
    expect(calls.filter((c) => c === 'groups.v1.json')).toHaveLength(1)
    expect(a?.get('owls')?.name.en).toBe('Owls')
    const file = { v: 1, note: '', birds: [], species: [], regions: { v: 1, countries: {}, sub1: {} }, layouts: [], loc: {} } as never
    expect(fromPackFile(file, a).species.groups?.get('owls')).toBeDefined()
    expect(fromPackFile(file).species.groups).toBeUndefined()
  })
})
