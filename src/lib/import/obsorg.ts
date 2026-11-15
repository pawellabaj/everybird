import Papa from 'papaparse'
import type { ImportResult, SourceRecord, Unmatched } from '@/lib/list/model'
import { resolveName, type Resolution, type TaxonomyIndex } from '@/lib/species/resolve'
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
  const key = (type ?? '').trim().toLowerCase()
  const known = Object.hasOwn(ROW_TYPES, key) ? ROW_TYPES[key] : undefined
  if (known) return known
  if (/\/|\s+x\s+|×|\(|(?:^|\s)\S+\.(?:\s|$)/i.test(sci)) return 'skip'
  const words = sci.trim().split(/\s+/).length
  return words === 2 ? 'species' : words === 3 ? 'subspecies' : 'skip'
}

/** Scientific names only; exact taxonomy, then local and iNaturalist synonyms; only subspecies reduce. */
export function resolveObsOrgName(
  t: TaxonomyIndex, sci: string, kind: Exclude<ObsOrgRowKind, 'skip'>, synonyms: Record<string, string>,
): Resolution {
  const resolve = (name: string): Resolution => {
    const result = resolveName(t, { sci: name })
    if (result.code !== null) return result
    const lower = name.toLowerCase()
    const code = (Object.hasOwn(OBSORG_SYNONYMS, lower) ? OBSORG_SYNONYMS[lower] : undefined)
      ?? (Object.hasOwn(synonyms, name) ? synonyms[name] : undefined)
    return code ? { code, via: 'sci' } : result
  }
  const result = resolve(sci.trim())
  if (result.code !== null || kind !== 'subspecies') return result
  const binomial = sci.trim().split(/\s+/).slice(0, 2).join(' ')
  return binomial === sci.trim() ? result : resolve(binomial)
}

type Row = Record<string, string | undefined>
const isoDate = (value: string | undefined): string | undefined => {
  const date = value?.trim()
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined
}
const earlier = (date: string | undefined, previous: string | undefined) => !!date && (!previous || date < previous)

/** Observed species: dates and names only, with whole nonbird groups dropped. No places or marks are inferred. */
export function parseObsOrgSpecies(csv: string, t: TaxonomyIndex, synonyms: Record<string, string>): ImportResult | { error: 'no-birds' } {
  const parsed = Papa.parse<Row>(csv.replace(/^\uFEFF/, ''), {
    header: true, skipEmptyLines: true, transformHeader: h => h.trim().toLowerCase(),
  })
  const groups = new Map<string, { records: Map<string, SourceRecord>; unmatched: Unmatched[] }>()
  parsed.data.forEach((r, i) => {
    const group = r.group ?? ''
    let g = groups.get(group)
    if (!g) groups.set(group, (g = { records: new Map(), unmatched: [] }))
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
      if (result.suggestion) u.suggestion = result.suggestion
      g.unmatched.push(u)
    } else {
      const previous = g.records.get(result.code)
      if (!previous || earlier(date, previous.date)) g.records.set(result.code, { code: result.code, source: 'obsorg', ...(date ? { date } : {}) })
    }
  })
  const byCode = new Map<string, SourceRecord>()
  const unmatched: Unmatched[] = []
  for (const g of groups.values()) {
    if (!g.records.size) continue
    unmatched.push(...g.unmatched)
    for (const r of g.records.values()) {
      const previous = byCode.get(r.code)
      if (!previous || earlier(r.date, previous.date)) byCode.set(r.code, r)
    }
  }
  if (!byCode.size && !unmatched.length) return { error: 'no-birds' }
  return { records: [...byCode.values()], unmatched: unmatched.sort((a,b) => a.row - b.row), skipped: 0, rows: parsed.data.length }
}

export type ObsOrgObservationsResult = ImportResult & { excluded: { escape: number; uncertain: number } }

/**
 * Stream observations, retaining only per-name/species/place aggregates. The seven column lookups below are the
 * complete allowlist: raw location names, coordinates, notes, ids, links and validator details are never inspected.
 */
export async function parseObsOrgObservations(
  csv: string | File, t: TaxonomyIndex, synonyms: Record<string, string>, regions: Regions,
  onProgress?: (rows: number) => void,
): Promise<ObsOrgObservationsResult | { error: 'no-birds' }> {
  const placeOf = makeObsOrgPlaces(regions)
  const byCode = new Map<string, SourceRecord>()
  const unmatched = new Map<string, Unmatched>()
  const resolutions = new Map<string, Resolution>()
  const seen = new SeenAgg()
  const seenUnmatched = new SeenAgg()
  const excluded = { escape: 0, uncertain: 0 }
  let rows = 0

  const onRow = (r: Row) => {
    rows++
    if (rows % 5000 === 0) onProgress?.(rows)
    const escape = r['is escape']?.trim().toLowerCase() === 'true'
    const uncertain = r['is certain']?.trim().toLowerCase() === 'false'
    if (escape) excluded.escape++
    if (uncertain) excluded.uncertain++
    if (escape || uncertain) return
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
      seenUnmatched.add(sci, place, date)
      const previous = unmatched.get(sci)
      if (!previous || earlier(date, previous.date)) {
        unmatched.set(sci, {
          source: 'obsorg', row: rows, sci, reason: result.reason,
          ...(result.suggestion ? { suggestion: result.suggestion } : {}),
          ...(date ? { date } : {}), ...(place ? { place } : {}),
        })
      }
    } else {
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
    for (const u of unmatched.values()) if (u.reason === 'no-match') u.seen = seenUnmatched.get(u.sci!) ?? []
    return { records, unmatched: [...unmatched.values()].sort((a,b) => a.row - b.row), skipped: 0, rows, excluded }
  }

  const run = (input: string | File) => new Promise<ObsOrgObservationsResult | { error: 'no-birds' }>((resolve, reject) => {
    Papa.parse<Row>(input as never, {
      header: true, skipEmptyLines: true, transformHeader: h => h.trim().toLowerCase(),
      step: (result, parser) => {
        if (result.errors.some(e => e.type === 'Quotes' || e.type === 'FieldMismatch')) {
          reject(new Error('Malformed observation.org CSV.'))
          parser.abort()
          return
        }
        onRow(result.data)
      },
      complete: () => resolve(finish()),
      error: () => reject(new Error('Could not read observation.org CSV.')),
    })
  })
  if (typeof csv === 'string') return run(csv.replace(/^\uFEFF/, ''))
  // Browser/worker FileReader streams the File; Node's test runner has only File.text().
  return typeof FileReader === 'undefined' ? run((await csv.text()).replace(/^\uFEFF/, '')) : run(csv)
}
