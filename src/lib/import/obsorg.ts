import Papa from 'papaparse'
import type { ImportResult, SourceRecord, Unmatched } from '@/lib/list/model'
import { resolveName, type Resolution, type TaxonomyIndex } from '@/lib/species/resolve'

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
  const known = ROW_TYPES[(type ?? '').trim().toLowerCase()]
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
    const code = OBSORG_SYNONYMS[name.toLowerCase()] ?? synonyms[name]
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
