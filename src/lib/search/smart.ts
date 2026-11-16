// Port of Nest Ledger's deterministic tokenizer/used-word parser, with Everybird's month precision and entities.
import type { Filter } from '../list/filters'
import { parsePlaceKey, placeName, keysOfPlace } from '../list/place-keys'
import { countryNameMap, sub1Names, SUB1_ALIASES, OBSORG_SUB1_ALIASES } from '../places/names'
import { searchKey, nameTier } from '../species/name-search'
import { ORDERS } from '../species/orders'
import type { Regions, SpeciesRow } from '../species/types'
import synonyms from '../../../data/i18n/group-synonyms.json'
import { dateParser, SEARCH_CONNECTORS, type SearchWord } from './dates'
import type { BirdGroup, SearchLang } from './groups'

export type SearchStatus = 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX' | 'DD' | 'NE'
/** Contract for part B, types only: current filtering still ignores these fields. */
export type SmartFilterFields = { group?: string; basis?: 'lifer' | 'seen'; statuses?: SearchStatus[] }
export type SmartFilter = Partial<Filter & SmartFilterFields>
export type Chip = {
  kind: 'date' | 'place' | 'group' | 'order' | 'family' | 'status' | 'basis'
  label: string
  token: string
  /** Exact source span, so accents, punctuation, repeated words and quoted text survive removal. */
  start: number
  end: number
}
export type SearchContext = {
  today: Date
  lang: SearchLang
  groups: readonly BirdGroup[]
  regions: Regions
  /** Place keys (c:CA, s:CA-BC, k:CA-BC|Capital), with or without their ancestors. */
  listPlaces: readonly string[]
  /** Localized IUCN labels from item 3. Built-in words and English remain available. */
  statuses?: readonly { code: SearchStatus; name: string; aliases?: readonly string[] }[]
  /** Optional on-list taxonomy supplies family names, as searchCollage does. */
  species?: readonly Pick<SpeciesRow, 'ord' | 'fam' | 'famCom'>[]
  orderNames?: Readonly<Record<string, string>>
  familyNames?: Readonly<Record<string, string>>
}

type Entity = { value: string; name: string; aliases: string[]; exactOnly?: boolean }
const GENERIC = new Set(['bird', 'birds', 'and', 'of', 'the', 'aves', 'vogel', 'vogels'])
const singular = (s: string) => s.split(' ').map((w) => w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w).join(' ')
const unique = <T,>(xs: Iterable<T>) => [...new Set(xs)]
const STATUS_WORDS: Record<SearchLang, Record<string, SearchStatus[]>> = {
  en: { threatened: ['VU', 'EN', 'CR'], vulnerable: ['VU'], endangered: ['EN'], 'critically endangered': ['CR'], 'near threatened': ['NT'], 'least concern': ['LC'], extinct: ['EX'], 'extinct in the wild': ['EW'], 'data deficient': ['DD'], 'not evaluated': ['NE'] },
  es: { amenazadas: ['VU', 'EN', 'CR'], amenazados: ['VU', 'EN', 'CR'], amenazada: ['VU', 'EN', 'CR'], vulnerable: ['VU'], vulnerables: ['VU'], 'en peligro': ['EN'], 'en peligro de extinción': ['EN'], 'en peligro crítico': ['CR'], 'casi amenazadas': ['NT'], 'preocupación menor': ['LC'], extintas: ['EX'], 'extinta en estado silvestre': ['EW'], 'datos insuficientes': ['DD'], 'no evaluada': ['NE'] },
  pt: { ameaçadas: ['VU', 'EN', 'CR'], ameaçados: ['VU', 'EN', 'CR'], ameaçada: ['VU', 'EN', 'CR'], vulnerável: ['VU'], vulneráveis: ['VU'], 'em perigo': ['EN'], 'criticamente em perigo': ['CR'], 'quase ameaçada': ['NT'], 'pouco preocupante': ['LC'], extintas: ['EX'], 'extinta na natureza': ['EW'], 'dados insuficientes': ['DD'], 'não avaliada': ['NE'] },
  nl: { bedreigd: ['VU', 'EN', 'CR'], kwetsbaar: ['VU'], 'sterk bedreigd': ['EN'], 'ernstig bedreigd': ['CR'], 'gevoelig': ['NT'], 'niet bedreigd': ['LC'], uitgestorven: ['EX'], 'uitgestorven in het wild': ['EW'], 'onvoldoende gegevens': ['DD'], 'niet geëvalueerd': ['NE'] },
}
const LIFERS: Record<SearchLang, string[]> = {
  en: ['lifer', 'lifers', 'new'], es: ['nuevas', 'nuevos', 'nueva', 'nuevo'], pt: ['novas', 'novos', 'nova', 'novo'], nl: ['nieuw', 'nieuwe'],
}

function tokenize(input: string): SearchWord[] {
  // Keep compounds (beija-flor, CA-BC), ISO dates, quotes and positions. A numeric year range splits at its dash.
  const re = /"[^"]*"|(?:19|20)\d{2}-\d{2}(?:-\d{2})?(?!\d)|(?:19|20)\d{2}(?![\p{L}\p{N}])|[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}]+)*|[-–—/]|[^\s]/gu
  return [...input.matchAll(re)].map((m) => ({ raw: m[0], key: searchKey(m[0]), start: m.index!, end: m.index! + m[0].length, quoted: m[0].startsWith('"') }))
}

function places(ctx: SearchContext): Entity[] {
  const out = new Map<string, Entity>()
  const add = (value: string, aliases: string[], exactOnly = false) => {
    const existing = out.get(value)
    if (existing) existing.aliases.push(...aliases.map(searchKey))
    else out.set(value, { value, name: placeName(value, ctx.regions), aliases: aliases.map(searchKey), exactOnly })
  }
  for (const [name, code] of countryNameMap(ctx.regions, ['en', ctx.lang])) add(`c:${code}`, [name])
  for (const [code, name] of Object.entries(ctx.regions.sub1)) {
    add(`s:${code}`, [code, ...sub1Names(name), ...(SUB1_ALIASES[code] ?? []), ...(OBSORG_SUB1_ALIASES[code] ?? [])])
  }
  const onList = new Set<string>()
  for (const key of ctx.listPlaces) {
    const p = parsePlaceKey(key)
    if (!p) continue
    for (const k of keysOfPlace({ country: p.country, sub1: p.sub1, sub2: p.county })) onList.add(k)
    if (p.level === 'county') add(key, [p.county!], true)
  }
  // Short sub1 suffixes are aliases only for places actually on this list. They are exact, never prefix matches.
  for (const key of onList) {
    const p = parsePlaceKey(key)!
    if (p.level === 'province') add(key, [p.sub1!.split('-').slice(1).join('-')])
  }
  return [...out.values()].map((p) => ({ ...p, aliases: unique(p.aliases) }))
}

/** Recognized spans become filters; every other word stays in its original spelling for bird-name search. */
export function parseSmart(input: string, ctx: SearchContext): { filter: SmartFilter; chips: Chip[]; rest: string } {
  const filter: SmartFilter = {}
  const chips: Chip[] = []
  const tokens = tokenize(input)
  const used = tokens.map(() => false)
  const invalidDates = new Set<number>()
  const languages = unique(['en', ctx.lang] as SearchLang[])
  const connectors = new Set(languages.flatMap((lang) => SEARCH_CONNECTORS[lang]).map(searchKey))
  const lifers = new Set(languages.flatMap((lang) => LIFERS[lang]).map(searchKey))
  const periodAt = dateParser(ctx.today, ctx.lang)
  const placeEntities = places(ctx)
  const onList = new Set<string>()
  for (const key of ctx.listPlaces) {
    const p = parsePlaceKey(key)
    if (p) for (const k of keysOfPlace({ country: p.country, sub1: p.sub1, sub2: p.county })) onList.add(k)
  }
  const groupEntities: Entity[] = ctx.groups.map((g) => ({ value: g.id, name: g.name[ctx.lang] || g.name.en,
    aliases: unique(languages.flatMap((lang) => [g.name[lang], ...((synonyms as Record<string, Partial<Record<SearchLang, string[]>>>)[g.id]?.[lang] ?? [])])).map(searchKey),
  }))
  const orderEntities = Object.entries({ ...ORDERS, ...ctx.orderNames }).map(([value, name]) => ({ value, name, aliases: [value, name, ORDERS[value]].filter(Boolean).map(searchKey) }))
  const familyEntities = unique((ctx.species ?? []).map((s) => s.fam)).map((value) => {
    const sp = ctx.species!.find((s) => s.fam === value)!
    const name = ctx.familyNames?.[value] ?? sp.famCom ?? value
    return { value, name, aliases: unique([value, name, sp.famCom]).filter(Boolean).map(searchKey) }
  })
  const statuses = new Map<string, SearchStatus[]>()
  for (const lang of languages) for (const [word, codes] of Object.entries(STATUS_WORDS[lang])) statuses.set(searchKey(word), codes)
  for (const s of ctx.statuses ?? []) for (const word of [s.name, ...(s.aliases ?? [])]) statuses.set(searchKey(word), [s.code])
  for (const code of ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD', 'NE'] as SearchStatus[]) statuses.set(code.toLowerCase(), [code])
  const addChip = (kind: Chip['kind'], label: string, i: number, n: number, lead = false) => {
    // A leading connector belongs to this chip only when immediately adjacent and unused; never discard all stopwords.
    if (lead && i > 0 && !used[i - 1] && !tokens[i - 1].quoted && connectors.has(tokens[i - 1].key)) { i--; n++ }
    for (let k = i; k < i + n; k++) used[k] = true
    const start = tokens[i].start, end = tokens[i + n - 1].end
    chips.push({ kind, label, token: input.slice(start, end), start, end })
  }
  const match = (entities: Entity[], phrase: string, fuzzy: boolean) => {
    const exact = entities.filter((e) => e.aliases.includes(phrase))
    if (exact.length || !fuzzy || phrase.length < 4 || phrase.split(' ').every((w) => GENERIC.has(w))) return exact
    return entities.filter((e) => !e.exactOnly && e.aliases.some((name) => singular(name) === singular(phrase) || name.startsWith(phrase) && nameTier(phrase, { com: name, sci: '' }) >= 0))
  }
  for (let i = 0; i < tokens.length; i++) {
    if (used[i] || tokens[i].quoted) continue
    const t = tokens[i]
    if (!invalidDates.has(i) && !chips.some((c) => c.kind === 'date')) {
      const period = periodAt(tokens, i)
      if (period?.invalid) {
        for (let j = i; j < i + period.n; j++) invalidDates.add(j)
      } else if (period && !used.slice(i, i + period.n).some(Boolean)) {
        if (period.from) filter.from = period.from
        if (period.to) filter.to = period.to
        if (filter.basis !== 'lifer') filter.basis = 'seen'
        const label = period.from === period.to ? period.from! : `${period.from ?? '…'}–${period.to ?? '…'}`
        addChip('date', label, i, period.n, true)
        continue
      }
    }
    // Longest contiguous entity first, like Nest Ledger. Counties can have more than four words.
    for (let n = Math.min(12, tokens.length - i); n >= 1; n--) {
      if (tokens.slice(i, i + n).some((t, j) => t.quoted || used[i + j] || !t.key && !/^[,&.]$/.test(t.raw))) continue
      const phrase = tokens.slice(i, i + n).map((t) => t.raw === '&' ? 'and' : t.key).filter(Boolean).join(' ')
      const status = statuses.get(phrase)
      // Spanish/Dutch "en" is a connector; the IUCN abbreviation is EN.
      if (status && !(n === 1 && connectors.has(phrase) && t.raw !== t.raw.toUpperCase())) {
        filter.statuses = unique([...(filter.statuses ?? []), ...status]).sort()
        addChip('status', input.slice(t.start, tokens[i + n - 1].end), i, n)
        break
      }
      let hits = match(placeEntities, phrase, false)
      if (hits.length > 1) {
        const listed = hits.filter((p) => onList.has(p.value))
        if (listed.length) hits = listed
      }
      // Code suffix ON must not steal the ordinary English connector "on".
      if (n === 1 && connectors.has(phrase) && t.raw !== t.raw.toUpperCase()) hits = []
      if (hits.length === 1) {
        const hit = hits[0], p = parsePlaceKey(hit.value)!
        const field = p.level === 'country' ? 'countries' : p.level === 'province' ? 'provinces' : 'counties'
        const value = p.level === 'country' ? p.country : p.level === 'province' ? p.sub1! : `${p.sub1}|${p.county}`
        filter[field] = unique([...(filter[field] ?? []), value]).sort()
        addChip('place', hit.name, i, n, true)
        break
      }
      if (!filter.group) {
        const exactTaxon = match(familyEntities, phrase, false).length || match(orderEntities, phrase, false).length
        const hits = match(groupEntities, phrase, !exactTaxon)
        if (hits.length === 1) {
          filter.group = hits[0].value
          addChip('group', hits[0].name, i, n)
          break
        }
      }
      if (!filter.order && !filter.family) {
        const orders = match(orderEntities, phrase, true), families = match(familyEntities, phrase, true)
        if (orders.length === 1) {
          filter.order = orders[0].value
          addChip('order', orders[0].name, i, n)
          break
        }
        if (families.length === 1) {
          filter.family = families[0].value
          filter.order = ctx.species?.find((s) => s.fam === families[0].value)?.ord
          addChip('family', families[0].name, i, n)
          break
        }
      }
    }
    if (!used[i] && lifers.has(t.key)) {
      filter.basis = 'lifer'
      addChip('basis', t.raw, i, 1)
    }
  }
  // Remove only recognized spans from the source, keeping unrecognized spelling, punctuation and word order.
  const spans = chips.slice().sort((a, b) => b.start - a.start)
  let rest = input
  for (const { start, end } of spans) rest = rest.slice(0, start) + ' ' + rest.slice(end)
  rest = rest.replace(/"([^"]*)"/g, '$1').replace(/\s+/g, ' ').trim()
  return { filter, chips, rest }
}

/** Remove exactly this chip's source span. A stale chip is harmless (the UI reparses after every edit). */
export function withoutChip(input: string, chip: Chip): string {
  if (input.slice(chip.start, chip.end) !== chip.token) return input
  return (input.slice(0, chip.start) + ' ' + input.slice(chip.end)).replace(/\s+/g, ' ').trim()
}
