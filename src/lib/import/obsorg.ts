import Papa from 'papaparse'
import type { ImportResult, SourceRecord, Unmatched } from '@/lib/list/model'
import { resolveName, suggestName, type Resolution, type TaxonomyIndex } from '@/lib/species/resolve'
import type { Regions } from '@/lib/species/types'
import { SeenAgg } from '@/lib/list/seen'
import { makeObsOrgPlaces } from './obsorg-places'

export type ObsOrgRowKind = 'species' | 'subspecies' | 'synonym' | 'skip'

// eBird's Milvus migrans aegyptius/parasitus is an issf of Black Kite, not a separate species.
export const OBSORG_SYNONYMS: Readonly<Record<string, string>> = { 'milvus aegyptius': 'blakit1' }

const ROW_TYPES: Record<string, ObsOrgRowKind> = {
  soort: 'species', species: 'species', ondersoort: 'subspecies', subspecies: 'subspecies',
  synoniem: 'synonym', synonym: 'synonym', verzamelsoort: 'skip', aggregate: 'skip',
  'species group': 'skip', 'species aggregate': 'skip', hybride: 'skip', hybrid: 'skip',
  forma: 'skip', form: 'skip', 'variëteit': 'skip', variety: 'skip',
}

/** Classify before resolving: the shared resolver strips parentheses, which would otherwise count forms. */
export function rowKind(type: string | undefined, sci: string): ObsOrgRowKind {
  // NFC: 'variëteit' may arrive decomposed (e + combining diaeresis).
  const key = (type ?? '').normalize('NFC').trim().toLowerCase()
  const known = Object.hasOwn(ROW_TYPES, key) ? ROW_TYPES[key] : undefined
  if (known) return known
  if (/\/|\s+x\s+|×|\(|(?:^|\s)\S+\.(?:\s|$)/i.test(sci)) return 'skip'
  const words = sci.trim().split(/\s+/).length
  return words === 2 ? 'species' : words === 3 ? 'subspecies' : 'skip'
}

const binomialOf = (sci: string) => sci.trim().split(/\s+/).slice(0, 2).join(' ')

/**
 * Scientific names only; exact taxonomy, then local and iNaturalist synonyms; only subspecies reduce. Never suggests
 * (a suggestion scans the whole taxonomy): the parsers call `obsOrgSuggester` for the few names left unmatched.
 */
export function resolveObsOrgName(
  t: TaxonomyIndex, sci: string, kind: Exclude<ObsOrgRowKind, 'skip'>, synonyms: Record<string, string>,
): Resolution {
  const resolve = (name: string): Resolution => {
    const result = resolveName(t, { sci: name }, { suggest: false })
    if (result.code !== null) return result
    const lower = name.toLowerCase()
    const code = (Object.hasOwn(OBSORG_SYNONYMS, lower) ? OBSORG_SYNONYMS[lower] : undefined)
      ?? (Object.hasOwn(synonyms, name) ? synonyms[name] : undefined)
    return code ? { code, via: 'sci' } : result
  }
  const result = resolve(sci.trim())
  if (result.code !== null || kind !== 'subspecies') return result
  const binomial = binomialOf(sci)
  return binomial === sci.trim() ? result : resolve(binomial)
}

/** At most this many distinct unmatched names get a suggestion per import; the rest are listed without one. */
export const SUGGEST_MAX = 200

/**
 * Suggestions for unmatched names, once per distinct name (a subspecies by its binomial, as it was resolved), for the
 * first SUGGEST_MAX distinct names asked about.
 */
export function obsOrgSuggester(t: TaxonomyIndex): (sci: string, kind: Exclude<ObsOrgRowKind, 'skip'>) => string | undefined {
  const cache = new Map<string, string | undefined>()
  return (sci, kind) => {
    const name = kind === 'subspecies' ? binomialOf(sci) : sci.trim()
    if (cache.has(name)) return cache.get(name)
    if (cache.size >= SUGGEST_MAX) return undefined
    const suggestion = suggestName(t, { sci: name })
    cache.set(name, suggestion)
    return suggestion
  }
}

type Row = Record<string, string | undefined>
const isoDate = (value: string | undefined): string | undefined => {
  const date = value?.trim()
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined
}
const earlier = (date: string | undefined, previous: string | undefined) => !!date && (!previous || date < previous)
const MALFORMED = 'Malformed observation.org CSV.'
/** A quoting error or a row whose field count differs from the header's: the file isn't the CSV it claims to be. */
const malformed = (errors: readonly Papa.ParseError[]) => errors.some((e) => e.type === 'Quotes' || e.type === 'FieldMismatch')
const PARSE = { header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim().toLowerCase() } as const

/**
 * `undated`: counted rows (resolved to a species, in a kept group) without an ISO `YYYY-MM-DD` date. Dates are read
 * as ISO only (observation.org writes them so); any other form is not guessed at, and the bird counts undated.
 */
export type ObsOrgSpeciesResult = ImportResult & { undated: number }

/**
 * Observed species: dates and names only, with whole nonbird groups dropped. No places or marks are inferred. Every
 * name is resolved exactly first and the group rule applied; only then do the unmatched rows of kept groups get
 * suggestions (`obsOrgSuggester`). Throws on a malformed CSV.
 */
export function parseObsOrgSpecies(csv: string, t: TaxonomyIndex, synonyms: Record<string, string>): ObsOrgSpeciesResult | { error: 'no-birds' } {
  const parsed = Papa.parse<Row>(csv.replace(/^﻿/, ''), PARSE)
  if (malformed(parsed.errors)) throw new Error(MALFORMED)
  type Miss = { u: Unmatched; sci: string; kind: Exclude<ObsOrgRowKind, 'skip'> | null }
  type Group = { records: Map<string, SourceRecord>; unmatched: Miss[]; undated: number }
  const groups = new Map<string, Group>()
  parsed.data.forEach((r, i) => {
    const group = r.group ?? ''
    let g = groups.get(group)
    if (!g) groups.set(group, (g = { records: new Map(), unmatched: [], undated: 0 }))
    const sci = r['scientific name']?.trim() ?? ''
    const com = r.name?.trim() || undefined
    const kind = rowKind(r['species type'], sci)
    const result: Resolution = kind === 'skip' ? { code: null, reason: 'not-species' } : resolveObsOrgName(t, sci, kind, synonyms)
    const date = isoDate(r['date first observed'])
    if (result.code === null) {
      const u: Unmatched = { source: 'obsorg', row: i + 1, reason: result.reason }
      if (sci) u.sci = sci
      if (com) u.com = com
      if (date) u.date = date
      g.unmatched.push({ u, sci, kind: kind === 'skip' ? null : kind })
    } else {
      if (!date) g.undated++
      const previous = g.records.get(result.code)
      if (!previous || earlier(date, previous.date)) g.records.set(result.code, { code: result.code, source: 'obsorg', ...(date ? { date } : {}) })
    }
  })
  const byCode = new Map<string, SourceRecord>()
  const misses: Miss[] = []
  let undated = 0
  for (const g of groups.values()) {
    if (!g.records.size) continue
    misses.push(...g.unmatched)
    undated += g.undated
    for (const r of g.records.values()) {
      const previous = byCode.get(r.code)
      if (!previous || earlier(r.date, previous.date)) byCode.set(r.code, r)
    }
  }
  if (!byCode.size && !misses.length) return { error: 'no-birds' }
  misses.sort((a, b) => a.u.row - b.u.row)
  const suggest = obsOrgSuggester(t)
  for (const m of misses) {
    if (m.u.reason !== 'no-match' || !m.kind || !m.sci) continue
    const suggestion = suggest(m.sci, m.kind)
    if (suggestion) m.u.suggestion = suggestion
  }
  return { records: [...byCode.values()], unmatched: misses.map((m) => m.u), skipped: 0, rows: parsed.data.length, undated }
}

export type ObsOrgObservationsResult = ImportResult & {
  /** Rows left out, each counted once: an escape first, else an uncertain record. */
  excluded: { escape: number; uncertain: number }
  /** Counted rows without an ISO date (as ObsOrgSpeciesResult's). */
  undated: number
}

/**
 * Observations, row by row (papaparse `step`) over the file's text, retaining only per-name/species/place aggregates.
 * The seven column lookups below are the complete allowlist: raw location names, coordinates, notes, ids, links and
 * validator details are never inspected. Names are resolved exactly, once per distinct name; suggestions are computed
 * at the end, for unmatched names only (`obsOrgSuggester`).
 */
export async function parseObsOrgObservations(
  csv: string | File, t: TaxonomyIndex, synonyms: Record<string, string>, regions: Regions,
  onProgress?: (rows: number) => void,
): Promise<ObsOrgObservationsResult | { error: 'no-birds' }> {
  const placeOf = makeObsOrgPlaces(regions)
  const byCode = new Map<string, SourceRecord>()
  const unmatched = new Map<string, Unmatched>()
  const kinds = new Map<string, Exclude<ObsOrgRowKind, 'skip'>>()
  const resolutions = new Map<string, Resolution>()
  const seen = new SeenAgg()
  const seenUnmatched = new SeenAgg()
  const excluded = { escape: 0, uncertain: 0 }
  let rows = 0
  let undated = 0

  const onRow = (r: Row) => {
    rows++
    if (rows % 5000 === 0) onProgress?.(rows)
    if (r['is escape']?.trim().toLowerCase() === 'true') {
      excluded.escape++
      return
    }
    if (r['is certain']?.trim().toLowerCase() === 'false') {
      excluded.uncertain++
      return
    }
    const sci = r['scientific name']?.trim() ?? ''
    if (!sci) return
    const kind = rowKind(r['species type'], sci)
    const key = `${kind}\u0000${sci}`
    let result = resolutions.get(key)
    if (!result) {
      result = kind === 'skip' ? { code: null, reason: 'not-species' } : resolveObsOrgName(t, sci, kind, synonyms)
      resolutions.set(key, result)
    }
    if (result.code === null && result.reason === 'not-species') {
      if (!unmatched.has(sci)) unmatched.set(sci, { source: 'obsorg', row: rows, sci, reason: 'not-species' })
      return
    }
    const date = isoDate(r.date)
    const place = placeOf(r.country ?? '', r['country division'] ?? '')
    if (result.code === null) {
      if (kind !== 'skip' && !kinds.has(sci)) kinds.set(sci, kind)
      seenUnmatched.add(sci, place, date)
      const previous = unmatched.get(sci)
      if (!previous || earlier(date, previous.date)) {
        unmatched.set(sci, {
          source: 'obsorg', row: rows, sci, reason: result.reason,
          ...(date ? { date } : {}), ...(place ? { place } : {}),
        })
      }
    } else {
      if (!date) undated++
      seen.add(result.code, place, date)
      const previous = byCode.get(result.code)
      if (!previous || earlier(date, previous.date)) {
        // Replace the whole lifer so an earlier unplaced row cannot inherit a later row's place.
        byCode.set(result.code, { code: result.code, source: 'obsorg', ...(date ? { date } : {}), ...(place ? { place } : {}) })
      }
    }
  }

  const finish = (): ObsOrgObservationsResult | { error: 'no-birds' } => {
    if (!byCode.size && !unmatched.size) return { error: 'no-birds' }
    const records = [...byCode.values()]
    for (const r of records) r.seen = seen.get(r.code) ?? []
    const list = [...unmatched.values()].sort((a, b) => a.row - b.row)
    const suggest = obsOrgSuggester(t)
    for (const u of list) {
      if (u.reason !== 'no-match') continue
      u.seen = seenUnmatched.get(u.sci!) ?? []
      const suggestion = suggest(u.sci!, kinds.get(u.sci!) ?? 'species')
      if (suggestion) u.suggestion = suggestion
    }
    return { records, unmatched: list, skipped: 0, rows, excluded, undated }
  }

  // The whole text, then step: one code path for the browser, the worker and the tests.
  const text = (typeof csv === 'string' ? csv : await csv.text()).replace(/^﻿/, '')
  return new Promise((resolve, reject) => {
    let failed = false
    Papa.parse<Row>(text, {
      ...PARSE,
      step: (result, parser) => {
        if (failed) return
        if (malformed(result.errors)) {
          failed = true
          reject(new Error(MALFORMED))
          parser.abort()
          return
        }
        onRow(result.data)
      },
      complete: () => {
        if (!failed) resolve(finish())
      },
      error: () => {
        failed = true
        reject(new Error('Could not read observation.org CSV.'))
      },
    })
  })
}
