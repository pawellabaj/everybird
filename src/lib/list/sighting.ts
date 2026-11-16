// Where and when a species was seen inside a filter, from the month sets (seen.ts `SeenEntry.months`, decoded once per
// list by buildSeen). Two users: the filter's matcher, for basis "seen" ("seen at one of these places in this period":
// filters.ts), and the card and tooltip, which show the first sighting inside a Places or Time filter instead of the
// lifer ("Canada · Mar 2023" for a Merlin first seen in Egypt in 2019; `sightingIn`, month precision).
// Matching is O(places of the species) per species: each place's months are sorted ordinals, so a range is one binary
// search. A species with no month data (an older save, a life-list-only source) has no `months`: callers fall back to
// its seen-here places and its lifer date, as before.
import { CONTINENT_OF } from '@/lib/places/continents'
import type { Filter } from './filters'
import type { ListEntry, Place } from './model'
import type { PlaceMonths, SeenIndex } from './seen'

/** A month ('YYYY-MM') as an ordinal, year * 12 + month - 1. */
export const monthOrd = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1
const monthOfOrd = (o: number): string => `${String(Math.floor(o / 12)).padStart(4, '0')}-${String((o % 12) + 1).padStart(2, '0')}`

/** What a sighting must satisfy: in any of `keys` (place keys) or on any of `continents`, and in lo..hi (month ordinals, either end open). Neither keys nor continents: anywhere. */
export type Where = { keys: readonly string[]; continents: readonly string[]; lo: number; hi: number }

export function makeWhere(keys: readonly string[] | undefined, continents: readonly string[] | undefined, from?: string, to?: string): Where {
  return { keys: keys ?? [], continents: continents ?? [], lo: from ? monthOrd(from) : -Infinity, hi: to ? monthOrd(to) : Infinity }
}

/** The filter's places and range as a Where; undefined when it has neither (nothing to find a sighting in). */
export function whereOf(f: Filter): Where | undefined {
  const keys = [...(f.countries ?? []).map((c) => `c:${c}`), ...(f.provinces ?? []).map((s) => `s:${s}`), ...(f.counties ?? []).map((k) => `k:${k}`)]
  if (!keys.length && !f.continents?.length && !f.from && !f.to) return undefined
  return makeWhere(keys, f.continents, f.from, f.to)
}

function placeHit(pm: PlaceMonths, w: Where): boolean {
  if (!w.keys.length && !w.continents.length) return true
  for (const k of pm.keys) if (w.keys.includes(k)) return true
  return w.continents.length > 0 && w.continents.includes(CONTINENT_OF[pm.place.country])
}

/** The first ordinal of `ords` (ascending) inside lo..hi, or undefined. */
function firstIn(ords: readonly number[], lo: number, hi: number): number | undefined {
  let a = 0, b = ords.length
  while (a < b) {
    const mid = (a + b) >> 1
    if (ords[mid] < lo) a = mid + 1
    else b = mid
  }
  return a < ords.length && ords[a] <= hi ? ords[a] : undefined
}

/** Whether some place satisfying `w` has a month in its range. */
export function seenWhere(months: readonly PlaceMonths[], w: Where): boolean {
  for (const pm of months) if (placeHit(pm, w) && firstIn(pm.ords, w.lo, w.hi) !== undefined) return true
  return false
}

/** The keys ("region[|county]") of the places with a month in `w`'s range (anywhere in `w` when it names none). */
export function keysSeenIn(months: readonly PlaceMonths[], w: Where): Set<string> {
  const out = new Set<string>()
  for (const pm of months) if (placeHit(pm, w) && firstIn(pm.ords, w.lo, w.hi) !== undefined) out.add(pm.key)
  return out
}

export type Sighting = { date: string; place: Place }

/** The earliest sighting satisfying `w` (the first of the places on a tie): its month and place. */
export function firstSighting(months: readonly PlaceMonths[], w: Where): Sighting | undefined {
  let best: number | undefined
  let at: PlaceMonths | undefined
  for (const pm of months) {
    if (!placeHit(pm, w)) continue
    const o = firstIn(pm.ords, w.lo, w.hi)
    if (o !== undefined && (best === undefined || o < best)) { best = o; at = pm }
  }
  if (best === undefined || !at) return undefined
  const { country, sub1, sub2 } = at.place
  return { date: monthOfOrd(best), place: { country, ...(sub1 ? { sub1 } : {}), ...(sub2 ? { sub2 } : {}) } }
}

/**
 * The first sighting of `entry` inside the filter's Places and Time (either basis): its month and place. Undefined
 * with no place or time in the filter, with no month data for the species, or when nothing inside the filter has a
 * month: the lifer's date and place then stand, as without a filter.
 */
export function sightingIn(entry: ListEntry, filter: Filter, seen?: SeenIndex): Sighting | undefined {
  const months = seen?.byCode.get(entry.code)?.months
  const w = months && whereOf(filter)
  return months && w ? firstSighting(months, w) : undefined
}

/** `entry` with its date and place those of its first sighting inside the filter (else the entry itself). */
export function entryInFilter(entry: ListEntry, filter: Filter | undefined, seen?: SeenIndex): ListEntry {
  const s = filter && sightingIn(entry, filter, seen)
  return s ? { ...entry, date: s.date, place: s.place } : entry
}
