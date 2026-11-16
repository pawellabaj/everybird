import type { SpeciesIndex } from '@/lib/species/load'
import { orderLabel } from '@/lib/species/orders'
import type { ListEntry } from './model'
import { isWithin, parentKey, parsePlaceKey } from './place-keys'
import { keysOf, seenOf, type SeenIndex } from './seen'

/**
 * The active filters. Time: `from`/`to` are a range of months (YYYY-MM, inclusive, either end open; see timeline.ts).
 * `year` still filters (old state, search picks), but the store turns it into the range Jan..Dec of that year.
 * Places: three levels, each a sorted set never empty when set: `countries` (ISO2 codes), `provinces` (sub1 codes,
 * "CA-BC") and `counties` ("CA-BC|Capital", always under its province). Together they keep the species SEEN in ANY of
 * the chosen places (seen.ts; the keys are place-keys.ts'), not only the lifers there, when the functions below get the
 * seen-here index; without it (a shared link) the lifer places stand in. A selection never holds a place and one of
 * its ancestors (withPlaces). Time stays about lifers: places and a range together keep the species seen there whose
 * lifer falls in the range. (Trips are gone: an old `trip` value is dropped by applyFilterValidity.)
 */
export type Filter = {
  order?: string
  family?: string
  countries?: string[]
  provinces?: string[]
  counties?: string[]
  year?: string
  from?: string
  to?: string
}
export type ChipOption = { value: string; label: string; count: number }
/** `country`: the countries' options (the filter holds a set, `countries`); as a skipped dimension, every place level. */
export type FilterLevel = 'order' | 'family' | 'country' | 'year'
/** The range (`from`/`to`) as one dimension, for skipping it when counting. */
type Dim = FilterLevel | 'range'
type Level = FilterLevel

const yearOf = (e: ListEntry) => (e.date && /^\d{4}/.test(e.date) ? e.date.slice(0, 4) : undefined)

/**
 * Whether an entry's date falls in the range from..to (YYYY-MM, inclusive, either open). A month or full date is
 * compared by its month; a year-only date matches when its year overlaps the range. Undated entries never match.
 */
export function inRange(date: string | undefined, from: string | undefined, to: string | undefined): boolean {
  if (!from && !to) return true
  const m = date && /^(\d{4})(?:-(\d{2}))?/.exec(date)
  if (!m) return false
  const lo = m[2] ? `${m[1]}-${m[2]}` : `${m[1]}-01`
  const hi = m[2] ? lo : `${m[1]}-12`
  return (!from || hi >= from) && (!to || lo <= to)
}
/**
 * Stable key, e.g. "o:Passeriformes|f:Corvidae|c:CA,EG|s:US-WA|k:CA-BC|Capital|y:2026|r:2026-03~2026-09"; empty values
 * are omitted (so filters without a range, provinces or counties keep the keys they always had).
 */
export function filterKey(f: Filter): string {
  const parts: string[] = []
  if (f.order) parts.push(`o:${f.order}`)
  if (f.family) parts.push(`f:${f.family}`)
  if (f.countries?.length) parts.push(`c:${[...f.countries].sort().join(',')}`)
  if (f.provinces?.length) parts.push(`s:${[...f.provinces].sort().join(',')}`)
  if (f.counties?.length) parts.push(`k:${[...f.counties].sort().join(',')}`)
  if (f.year) parts.push(`y:${f.year}`)
  if (f.from || f.to) parts.push(`r:${f.from ?? ''}~${f.to ?? ''}`)
  return parts.join('|')
}

/**
 * Build one O(1)-per-entry predicate for the filter, ignoring the dimensions in `skip`.
 * Drill-down: a family outside the chosen order matches nothing.
 * A child set without its parent is applied on its own (the store drops such state).
 */
function matcher(f: Filter, species: SpeciesIndex, skip: ReadonlySet<Dim>, seen?: SeenIndex) {
  const order = skip.has('order') ? undefined : f.order
  const family = skip.has('family') ? undefined : f.family
  // Seen in any of the chosen places, at any level.
  const places = !skip.has('country') && hasPlaces(f) ? filterPlaceKeys(f) : undefined
  const year = skip.has('year') ? undefined : f.year
  const from = skip.has('range') ? undefined : f.from
  const to = skip.has('range') ? undefined : f.to
  return (e: ListEntry): boolean => {
    if (order || family) {
      const row = species.byCode.get(e.code)
      if (!row) return false
      if (order && row.ord !== order) return false
      if (family && row.fam !== family) return false
    }
    if (places) {
      const keys = keysOf(seen, e)
      if (!places.some((k) => keys.has(k))) return false
    }
    if (year && yearOf(e) !== year) return false
    if ((from || to) && !inRange(e.date, from, to)) return false
    return true
  }
}

/** `seen`: the seen-here index (the Places filter keeps species seen there); without it, lifer places. */
export function applyFilter(list: ListEntry[], f: Filter, species: SpeciesIndex, seen?: SeenIndex): ListEntry[] {
  const m = matcher(f, species, new Set(), seen)
  return list.filter(m)
}

const SKIP: Record<Level, Dim[]> = {
  order: ['order', 'family'], // a family implies its order
  family: ['family'],
  country: ['country'], // countries are counted whatever is checked (a multi-select)
  year: ['year', 'range'], // years are counted over the whole span
}

/**
 * Chips for one level, counted under the OTHER active dimensions (family also under the active order).
 * Only options with count > 0.
 * Order: order/family by taxonomic position of their first species, country by count desc then label,
 * year descending. Legacy: the 'year' level is no longer shown as chips (the Time panel is the timeline); it is kept
 * for callers and tests of the old drill-down.
 * Countries count species SEEN in each (each species once per country), whatever countries are checked, sorted by
 * count, then label. `name` labels countries by code (default: the code). `seen`: the seen-here index (else lifer
 * places).
 */
export function options(
  list: ListEntry[],
  f: Filter,
  level: Level,
  species: SpeciesIndex,
  name: (code: string) => string = (code) => code,
  seen?: SeenIndex,
): ChipOption[] {
  if (level === 'family' && !f.order) return []
  const m = matcher(f, species, new Set(SKIP[level]), seen)
  const counts = new Map<string, number>()
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1)

  const firstTo = new Map<string, number>()
  const famLabel = new Map<string, string>()
  for (const e of list) {
    if (!m(e)) continue
    if (level === 'order' || level === 'family') {
      const row = species.byCode.get(e.code)
      if (!row) continue
      const key = level === 'order' ? row.ord : row.fam
      bump(key)
      if (!firstTo.has(key) || row.to < firstTo.get(key)!) firstTo.set(key, row.to)
      if (level === 'family') famLabel.set(key, row.famCom)
    } else if (level === 'country') {
      const here = new Set<string>()
      for (const p of seenOf(seen, e)) here.add(p.country)
      for (const k of here) bump(k)
    } else {
      const y = yearOf(e)
      if (y) bump(y)
    }
  }

  const label = (v: string) =>
    level === 'order' ? orderLabel(v) : level === 'family' ? famLabel.get(v) || v : level === 'country' ? name(v) : v
  const out = [...counts].map(([value, count]) => ({ value, label: label(value), count }))
  if (level === 'order' || level === 'family') out.sort((a, b) => firstTo.get(a.value)! - firstTo.get(b.value)!)
  else if (level === 'country') out.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  else out.sort((a, b) => (a.value < b.value ? 1 : -1))
  return out
}

/**
 * The filter that shows `e` (a search pick outside the current view): every dimension that already includes the bird
 * stays; the ones that exclude it go (another order clears the family too).
 */
export function filterToShow(f: Filter, e: ListEntry, species: SpeciesIndex, seen?: SeenIndex): Filter {
  const row = species.byCode.get(e.code)
  const next: Filter = { ...f }
  if (next.order && row?.ord !== next.order) { delete next.order; delete next.family }
  if (next.family && row?.fam !== next.family) delete next.family
  const keys = keysOf(seen, e)
  if (hasPlaces(next) && !filterPlaceKeys(next).some((k) => keys.has(k))) {
    delete next.countries
    delete next.provinces
    delete next.counties
  }
  if (next.year && yearOf(e) !== next.year) delete next.year
  if ((next.from || next.to) && !inRange(e.date, next.from, next.to)) { delete next.from; delete next.to }
  for (const k of Object.keys(next) as (keyof Filter)[]) if (!next[k]) delete next[k]
  return next
}

/**
 * Drill into an order or family from a search pick: within the current place and time filters, or with them cleared
 * when they would leave the group empty.
 */
export function drillTo(f: Filter, group: { order: string; family?: string }, list: ListEntry[], species: SpeciesIndex, seen?: SeenIndex): Filter {
  const next: Filter = { ...f, order: group.order }
  if (group.family) next.family = group.family
  else delete next.family
  return applyFilter(list, next, species, seen).length ? next : { ...group }
}

/** The filter's places as keys: countries, then provinces, then counties ("c:MX", "s:CA-BC", "k:US-WA|King"). */
export function filterPlaceKeys(f: Filter): string[] {
  return [
    ...(f.countries ?? []).map((c) => `c:${c}`),
    ...(f.provinces ?? []).map((s) => `s:${s}`),
    ...(f.counties ?? []).map((k) => `k:${k}`),
  ]
}

/** True when any place level is set. */
export function hasPlaces(f: Filter): boolean {
  return !!(f.countries?.length || f.provinces?.length || f.counties?.length)
}

/**
 * The filter with exactly these places (keys of any level): malformed keys go, duplicates go, a key with an ancestor
 * also present goes (the ancestor already holds it), each level is sorted, and an empty level is dropped.
 */
export function withPlaces(f: Filter, keys: readonly string[]): Filter {
  const set = new Set(keys.filter((k) => typeof k === 'string' && parsePlaceKey(k)))
  const covered = (k: string) => {
    for (let up = parentKey(k); up; up = parentKey(up)) if (set.has(up)) return true
    return false
  }
  const countries: string[] = []
  const provinces: string[] = []
  const counties: string[] = []
  for (const k of set) {
    if (covered(k)) continue
    const at = k[0] === 'c' ? countries : k[0] === 's' ? provinces : counties
    at.push(k.slice(2))
  }
  const next: Filter = { ...f }
  delete next.countries
  delete next.provinces
  delete next.counties
  if (countries.length) next.countries = countries.sort()
  if (provinces.length) next.provinces = provinces.sort()
  if (counties.length) next.counties = counties.sort()
  return next
}

/**
 * The filter with `key` unchecked when it is checked; else checked, with its checked ancestors and descendants removed
 * (checking British Columbia while Canada is checked narrows to British Columbia).
 */
export function togglePlace(f: Filter, key: string): Filter {
  const keys = filterPlaceKeys(f)
  if (keys.includes(key)) return withPlaces(f, keys.filter((k) => k !== key))
  return withPlaces(f, [...keys.filter((k) => !isWithin(k, key) && !isWithin(key, k)), key])
}

export type PlaceOption = ChipOption & { children: number }

/** A place's tally in one counting pass: species counted there (each once: `last` is the last entry counted). */
type Tally = { n: number; last: number }
type ProvinceTally = Tally & { counties: Set<string> }
type CountryTally = Tally & { provinces: Map<string, ProvinceTally> }

/**
 * Every Places level's counts in one pass over the list, under the OTHER filters (whatever places are checked), so the
 * panel counts once per change of the other filters and none per checkbox (placeRows reads a level from it). Built
 * from each seen place's own fields: countries by code; a country's provinces counted from its own places; a
 * province's counties counted from every place with that province code (as placeOptions always has).
 */
export type PlaceCounts = { countries: Map<string, CountryTally>; counties: Map<string, Map<string, Tally>> }

/** The counts for every level (see PlaceCounts). `seen`: the seen-here index (else lifer places). */
export function placeCounts(list: ListEntry[], f: Filter, species: SpeciesIndex, seen?: SeenIndex): PlaceCounts {
  const m = matcher(f, species, new Set(SKIP.country), seen)
  const countries = new Map<string, CountryTally>()
  const counties = new Map<string, Map<string, Tally>>()
  const tick = (t: Tally, i: number) => {
    if (t.last !== i) { t.last = i; t.n++ }
  }
  for (let i = 0; i < list.length; i++) {
    const e = list[i]
    if (!m(e)) continue
    for (const p of seenOf(seen, e)) {
      let c = countries.get(p.country)
      if (!c) countries.set(p.country, (c = { n: 0, last: -1, provinces: new Map() }))
      tick(c, i)
      if (!p.sub1) continue
      let s = c.provinces.get(p.sub1)
      if (!s) c.provinces.set(p.sub1, (s = { n: 0, last: -1, counties: new Set() }))
      tick(s, i)
      if (!p.sub2) continue
      s.counties.add(p.sub2)
      let ks = counties.get(p.sub1)
      if (!ks) counties.set(p.sub1, (ks = new Map()))
      let k = ks.get(p.sub2)
      if (!k) ks.set(p.sub2, (k = { n: 0, last: -1 }))
      tick(k, i)
    }
  }
  return { countries, counties }
}

/** The rows of the level under `parent` from counts already made (placeOptions without the pass over the list).
 *  Ties in count sort by name in `locale` (the UI language's BCP 47 tag). */
export function placeRows(counts: PlaceCounts, parent: string | undefined, label: (key: string) => string, locale?: string): PlaceOption[] {
  const out: PlaceOption[] = []
  const at = parent === undefined ? undefined : parsePlaceKey(parent)
  // A place whose key doesn't parse (an odd code) is listed but never drills: nothing can be found under it.
  const kids = (key: string, n: number) => (n && parsePlaceKey(key) ? n : 0)
  if (parent === undefined) {
    for (const [iso, c] of counts.countries) out.push({ value: `c:${iso}`, label: label(`c:${iso}`), count: c.n, children: kids(`c:${iso}`, c.provinces.size) })
  } else if (at?.level === 'country') {
    for (const [sub1, s] of counts.countries.get(at.country)?.provinces ?? []) out.push({ value: `s:${sub1}`, label: label(`s:${sub1}`), count: s.n, children: kids(`s:${sub1}`, s.counties.size) })
  } else if (at?.level === 'province') {
    for (const [name, k] of counts.counties.get(at.sub1!) ?? []) {
      const value = `k:${at.sub1}|${name}`
      out.push({ value, label: label(value), count: k.n, children: 0 })
    }
  }
  out.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, locale))
  return out
}

/**
 * The rows of the Places level under `parent` (undefined: countries; a country key: its provinces; a province key: its
 * counties): each place's key, its label, the species seen there (each once per row) under the OTHER filters but
 * whatever places are checked, and how many distinct places it holds one level down. Sorted by count, then label.
 * `seen`: the seen-here index (else lifer places). One level of placeCounts + placeRows.
 */
export function placeOptions(
  list: ListEntry[],
  f: Filter,
  parent: string | undefined,
  species: SpeciesIndex,
  label: (key: string) => string,
  seen?: SeenIndex,
): PlaceOption[] {
  return placeRows(placeCounts(list, f, species, seen), parent, label)
}

/** The filter with `iso` checked or unchecked in its countries (`togglePlace` on its country key). */
export function toggleCountry(f: Filter, iso: string): Filter {
  return togglePlace(f, `c:${iso}`)
}

/**
 * The filter with exactly these countries at the country level (sorted, deduplicated; none drops the level). Provinces
 * and counties outside them stay; the ones inside them go (the country holds them).
 */
export function withCountries(f: Filter, countries: readonly string[]): Filter {
  const others = filterPlaceKeys(f).filter((k) => !k.startsWith('c:'))
  return withPlaces(f, [...countries.filter(Boolean).map((c) => `c:${c}`), ...others])
}
