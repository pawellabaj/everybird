// Item 9 bug-check fixes: the group chip's matching, the shared groups fetch, the sample's groups, and a group dropping
// an order or family outside it.
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { parseSmart, type SearchContext } from '@/lib/search/smart'
import type { GroupsFile, SearchLang } from '@/lib/search/groups'

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
