import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseSmart, withoutChip, type SearchContext } from '@/lib/search/smart'
import type { GroupsFile, SearchLang } from '@/lib/search/groups'
const { groups }: GroupsFile = JSON.parse(readFileSync('public/data/groups.v1.json', 'utf8'))
const ctx: SearchContext = {
  today: new Date(2026, 10, 15, 12), lang: 'en', groups,
  regions: { v: 1, countries: { CA: 'Canada', MX: 'Mexico', NL: 'Netherlands', US: 'United States of America', GB: 'United Kingdom', AE: 'United Arab Emirates', GE: 'Georgia' },
    sub1: { 'CA-BC': 'British Columbia', 'CA-ON': 'Ontario', 'US-BC': 'Baja County', 'US-GA': 'Georgia', 'US-CA': 'California', 'NL-NH': 'North Holland' } },
  listPlaces: ['k:CA-BC|Central Valley', 's:CA-ON', 's:US-GA', 's:US-CA', 's:NL-NH'],
  species: [{ ord: 'Passeriformes', fam: 'Corvidae', famCom: 'Crows and jays' }],
}
const parse = (q: string, lang: SearchLang = 'en', extra: Partial<SearchContext> = {}) => parseSmart(q, { ...ctx, lang, ...extra })
const span = (q: string, lang: SearchLang = 'en') => { const { filter: f } = parse(q, lang); return [f.from, f.to] }

describe('approved smart-search verification cases', () => {
  it('waterfowl canada 2026 becomes group, c:CA and inclusive months with basis seen', () => {
    const r = parse('waterfowl canada 2026')
    expect(r.filter).toEqual({ group: 'waterfowl', countries: ['CA'], from: '2026-01', to: '2026-12', basis: 'seen' })
    expect(r.rest).toBe('')
    expect(r.chips.map((c) => c.kind)).toEqual(['group', 'place', 'date'])
  })
  it('handles spans, a bare latest month, last year, and hawks BC', () => {
    expect(span('oct 2025 - nov 2026')).toEqual(['2025-10', '2026-11'])
    expect(span('october')).toEqual(['2026-10', '2026-10'])
    expect(span('december')).toEqual(['2025-12', '2025-12'])
    expect(span('last year')).toEqual(['2025-01', '2025-12'])
    expect(parse('hawks BC').filter).toEqual({ group: 'vultures-hawks-and-allies', provinces: ['CA-BC'] })
  })
  it.each([
    ['es', 'patos méxico 2026', 'MX', '2026-01', '2026-12'],
    ['pt', 'patos méxico 2026', 'MX', '2026-01', '2026-12'],
    ['nl', 'eenden nederland 2025', 'NL', '2025-01', '2025-12'],
  ] as const)('%s groups, localized country names and years', (lang, q, country, from, to) => {
    expect(parse(q, lang).filter).toEqual({ group: 'waterfowl', countries: [country], from, to, basis: 'seen' })
    expect(parse(q, lang).rest).toBe('')
  })
  it.each(['en', 'es', 'pt', 'nl'] as const)('English works in %s, with lifers and unchanged leftovers', (lang) => {
    expect(parse('threatened', lang).filter.statuses).toEqual(['CR', 'EN', 'VU'])
    expect(parse('lifers 2024 Mystery Bird', lang)).toMatchObject({ filter: { basis: 'lifer', from: '2024-01', to: '2024-12' }, rest: 'Mystery Bird' })
    expect(parse('2024 new', lang).filter.basis).toBe('lifer')
    expect(parse('mysterious Wren!', lang).rest).toBe('mysterious Wren!')
  })
})

describe('every approved construction in every UI language', () => {
  it.each([
    ['en', 'waterfowl canada 2026', 'october', 'last year', 'hawks BC', 'threatened', 'lifers 2024'],
    ['es', 'patos canadá 2026', 'octubre', 'año pasado', 'águilas BC', 'amenazadas', 'nuevas 2024'],
    ['pt', 'patos canadá 2026', 'outubro', 'ano passado', 'gaviões BC', 'ameaçadas', 'novas 2024'],
    ['nl', 'eenden canada 2026', 'oktober', 'vorig jaar', 'haviken BC', 'bedreigd', 'nieuwe 2024'],
  ] as const)('%s recognizes groups, places, month names, spans, relative dates, status and lifers', (lang, q, month, last, hawk, status, lifer) => {
    expect(parse(q, lang).filter).toMatchObject({ group: 'waterfowl', countries: ['CA'], basis: 'seen', from: '2026-01', to: '2026-12' })
    expect(span(month, lang)).toEqual(['2026-10', '2026-10'])
    expect(span('oct 2025 - nov 2026', lang)).toEqual(['2025-10', '2026-11'])
    expect(span(last, lang)).toEqual(['2025-01', '2025-12'])
    expect(parse(hawk, lang).filter).toMatchObject({ group: 'vultures-hawks-and-allies', provinces: ['CA-BC'] })
    expect(parse(status, lang).filter.statuses).toEqual(['CR', 'EN', 'VU'])
    expect(parse(lifer, lang).filter).toMatchObject({ basis: 'lifer', from: '2024-01', to: '2024-12' })
    expect(parse('Unrecognized Thing!', lang).rest).toBe('Unrecognized Thing!')
  })
})

describe('ported date grammar at month precision', () => {
  it.each([
    ['july to oct', '2026-07', '2026-10'], ['from nov to feb', '2025-11', '2026-02'],
    ['between may and july 2025', '2025-05', '2025-07'], ['mar 2025 through jan', '2025-03', '2026-01'],
    ['oct / nov 2026', '2026-10', '2026-11'], ['2024-2025', '2024-01', '2025-12'],
    ['2026-07-04 to 2026-08-15', '2026-07', '2026-08'], ['2026-02', '2026-02', '2026-02'],
    ['q2 2025', '2025-04', '2025-06'], ['this quarter', '2026-10', '2026-12'], ['last quarter', '2026-07', '2026-09'],
    ['this year', '2026-01', '2026-12'], ['last month', '2026-10', '2026-10'], ['last 3 months', '2026-09', '2026-11'],
    ['since march', '2026-03', '2026-11'], ['after march', '2026-04', '2026-11'],
    ['until march', undefined, '2026-03'], ['before 2025', undefined, '2024-12'],
  ])('%s', (q, from, to) => expect(span(q)).toEqual([from, to]))
  it.each([
    ['es', 'entre octubre de 2025 y noviembre de 2026', '2025-10', '2026-11'],
    ['es', 'octubre 2025 hasta noviembre 2026', '2025-10', '2026-11'],
    ['pt', 'outubro de 2025 até novembro de 2026', '2025-10', '2026-11'],
    ['nl', 'oktober 2025 tot en met november 2026', '2025-10', '2026-11'],
    ['es', 'año pasado', '2025-01', '2025-12'], ['pt', 'ano passado', '2025-01', '2025-12'],
    ['es', 'último año', '2025-01', '2025-12'], ['pt', 'último ano', '2025-01', '2025-12'], ['nl', 'vorig jaar', '2025-01', '2025-12'],
    ['es', 'desde marzo', '2026-03', '2026-11'], ['pt', 'desde março', '2026-03', '2026-11'], ['nl', 'sinds maart', '2026-03', '2026-11'],
  ] as const)('%s: %s', (lang, q, from, to) => expect(span(q, lang)).toEqual([from, to]))
  it('refuses invalid dates, two-letter months and ambiguous prefixes', () => {
    for (const q of ['2026-02-30', '2026-13', '20260', '2026abc', 'ma', 'ju']) expect(parse(q).chips).toEqual([])
    expect(parse('2026-02-28').filter.from).toBe('2026-02')
    expect(parse('2026 - 2025')).toMatchObject({ filter: {}, rest: '2026 - 2025' })
  })
})

describe('places and taxonomy', () => {
  it('resolves country aliases, full codes and exact county names', () => {
    expect(parse('USA UK UAE').filter.countries).toEqual(['AE', 'GB', 'US'])
    expect(parse('CA-BC').filter.provinces).toEqual(['CA-BC'])
    expect(parse('Central Valley').filter.counties).toEqual(['CA-BC|Central Valley'])
    expect(parse('Central').filter.counties).toBeUndefined()
    expect(parse('Noord-Holland', 'nl').filter.provinces).toEqual(['NL-NH'])
  })
  it('prefers on-list ambiguous names and never guesses between tied places', () => {
    expect(parse('Georgia').filter.provinces).toEqual(['US-GA'])
    expect(parse('Georgia', 'en', { listPlaces: [] }).chips).toHaveLength(0)
    expect(parse('BC', 'en', { listPlaces: ['s:CA-BC', 's:US-BC'] }).chips).toHaveLength(0)
    expect(parse('BC', 'en', { listPlaces: [] }).chips).toHaveLength(0)
    expect(parse('on 2026').filter.provinces).toBeUndefined()
    expect(parse('ON 2026').filter.provinces).toEqual(['CA-ON'])
  })
  it('matches multiword groups, singulars, prefixes, orders and families', () => {
    expect(parse('Hawks, Eagles, and Kites').filter.group).toBe('vultures-hawks-and-allies')
    expect(parse('hummingbird').filter.group).toBe('hummingbirds')
    expect(parse('hummingb').filter.group).toBe('hummingbirds')
    expect(parse('Passeriformes').filter.order).toBe('Passeriformes')
    expect(parse('perching birds').filter.order).toBe('Passeriformes')
    expect(parse('Corvidae').filter).toMatchObject({ order: 'Passeriformes', family: 'Corvidae' })
    expect(parse('crows and jays').filter.family).toBe('Corvidae')
    expect(parse('New World Sparrows').filter.group).toBe('new-world-sparrows')
  })
})

describe('localized status and lifer vocabulary', () => {
  it.each([
    ['en', 'critically endangered', ['CR']], ['es', 'amenazadas', ['CR', 'EN', 'VU']],
    ['es', 'en peligro', ['EN']], ['pt', 'ameaçadas', ['CR', 'EN', 'VU']], ['pt', 'em perigo', ['EN']],
    ['nl', 'bedreigd', ['CR', 'EN', 'VU']], ['nl', 'ernstig bedreigd', ['CR']],
  ] as const)('%s: %s', (lang, q, status) => expect(parse(q, lang).filter.statuses).toEqual(status))
  it.each(['en', 'es', 'pt', 'nl'] as const)('%s understands IUCN codes', (lang) => {
    expect(parse('VU EN CR NT LC DD NE EX EW', lang).filter.statuses).toEqual(['CR', 'DD', 'EN', 'EW', 'EX', 'LC', 'NE', 'NT', 'VU'])
  })
  it('does not read Spanish en as endangered, and accepts contextual status labels', () => {
    expect(parse('patos en méxico', 'es')).toMatchObject({ filter: { group: 'waterfowl', countries: ['MX'] }, rest: '' })
    expect(parse('patos en méxico', 'es').filter.statuses).toBeUndefined()
    expect(parse('Custom label', 'en', { statuses: [{ code: 'NT', name: 'Custom label' }] }).filter.statuses).toEqual(['NT'])
  })
})

describe('source spans and purity', () => {
  it('quotes force bird-name text, preserving case and punctuation in leftovers', () => {
    expect(parse('"Canada Goose" 2026')).toMatchObject({ filter: { from: '2026-01' }, rest: 'Canada Goose' })
    expect(parse('"threatened" "october"').filter).toEqual({})
    expect(parse('Odd Bird! in Canada').rest).toBe('Odd Bird!')
  })
  it.each(['en', 'es', 'pt', 'nl'] as const)('removes only the selected %s chip with original accents/case', (lang) => {
    const q = 'patos MÉXICO 2026 Mystery'
    const r = parse(q, lang)
    const place = r.chips.find((c) => c.kind === 'place')!
    expect(withoutChip(q, place)).toBe('patos 2026 Mystery')
    expect(withoutChip('a changed query', place)).toBe('a changed query')
  })
  it('retains quoted duplicates and removes a span including its connector', () => {
    const q = '"Canada" in Canada 2026'
    const r = parse(q)
    expect(withoutChip(q, r.chips.find((c) => c.kind === 'place')!)).toBe('"Canada" 2026')
    const range = 'Odd Bird oct 2025 - nov 2026'
    expect(withoutChip(range, parse(range).chips.find((c) => c.kind === 'date')!)).toBe('Odd Bird')
  })
  it('is deterministic and does not mutate the context', () => {
    const before = JSON.stringify(ctx)
    expect(parse('waterfowl canada 2026')).toEqual(parse('waterfowl canada 2026'))
    expect(JSON.stringify(ctx)).toBe(before)
    expect(parse('')).toEqual({ filter: {}, chips: [], rest: '' })
  })
})
