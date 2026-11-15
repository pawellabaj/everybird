// Place keys: the Places filter's names for a country, a province or state, or a county, one level under the other.
//   c:<ISO2>                 "c:CA"
//   s:<sub1 code>            "s:CA-BC" (the shared view's synthetic "CA-share0" too)
//   k:<sub1 code>|<county>   "k:CA-BC|Capital" (always under its province, so same-named counties in two states differ)
// A county seen without a province counts at its country only. All pure.
import { stripBracket } from '@/lib/import/places'
import type { Regions } from '@/lib/species/types'

export type PlaceLevel = 'country' | 'province' | 'county'
export type ParsedPlace = { level: PlaceLevel; country: string; sub1?: string; county?: string }

type PlaceLike = { country: string; sub1?: string; sub2?: string }

const COUNTRY = /^[A-Z]{2}$/
const SUB1 = /^[A-Z]{2}-[A-Za-z0-9]+$/

/** What a key names, or undefined for anything that isn't a well-formed key. */
export function parsePlaceKey(key: string): ParsedPlace | undefined {
  const body = key.slice(2)
  if (key.startsWith('c:')) return COUNTRY.test(body) ? { level: 'country', country: body } : undefined
  if (key.startsWith('s:')) return SUB1.test(body) ? { level: 'province', country: body.slice(0, 2), sub1: body } : undefined
  if (key.startsWith('k:')) {
    const bar = body.indexOf('|')
    if (bar < 0) return undefined
    const sub1 = body.slice(0, bar)
    const county = body.slice(bar + 1)
    if (!SUB1.test(sub1) || !county) return undefined
    return { level: 'county', country: sub1.slice(0, 2), sub1, county }
  }
  return undefined
}

/** A place's keys at every level it has: ['c:CA', 's:CA-BC', 'k:CA-BC|Capital']. No county key without a province. */
export function keysOfPlace(p: PlaceLike): string[] {
  const out = [`c:${p.country}`]
  if (p.sub1) {
    out.push(`s:${p.sub1}`)
    if (p.sub2) out.push(`k:${p.sub1}|${p.sub2}`)
  }
  return out
}

/** The key one level up (a county's province, a province's country); undefined for a country or a malformed key. */
export function parentKey(key: string): string | undefined {
  const p = parsePlaceKey(key)
  if (!p || p.level === 'country') return undefined
  return p.level === 'county' ? `s:${p.sub1}` : `c:${p.country}`
}

/** True when `key` lies inside `ancestor` (strictly: a place is not within itself). */
export function isWithin(key: string, ancestor: string): boolean {
  for (let k = parentKey(key); k; k = parentKey(k)) if (k === ancestor) return true
  return false
}

/**
 * The place's key one level under `parent`: its country's with no parent, its province's under its own country, its
 * county's under its own province; undefined when the place isn't in `parent` or has nothing at the next level.
 */
export function childKey(p: PlaceLike, parent: string | undefined): string | undefined {
  return childKeyOf(parent)(p)
}

/** `childKey` with `parent` parsed once, for a loop over many places under the same parent. */
export function childKeyOf(parent: string | undefined): (p: PlaceLike) => string | undefined {
  if (parent === undefined) return (p) => `c:${p.country}`
  const at = parsePlaceKey(parent)
  if (at?.level === 'country') return (p) => (p.country === at.country && p.sub1 ? `s:${p.sub1}` : undefined)
  if (at?.level === 'province') return (p) => (p.sub1 === at.sub1 && p.sub2 ? `k:${p.sub1}|${p.sub2}` : undefined)
  return () => undefined
}

type Names = Pick<Regions, 'countries' | 'sub1'>

const countryName = (iso: string, r: Names) => (r.countries[iso] ? stripBracket(r.countries[iso]) : iso)
const sub1Name = (code: string, r: Names) => (r.sub1[code] ? stripBracket(r.sub1[code]) : code)

/** A key's own name: "Canada", "British Columbia", "Capital"; the code when the regions don't know it. */
export function placeName(key: string, regions: Names): string {
  const p = parsePlaceKey(key)
  if (!p) return key
  if (p.level === 'country') return countryName(p.country, regions)
  if (p.level === 'province') return sub1Name(p.sub1!, regions)
  return p.county!
}

/** A key's name with its parent's: "Canada", "British Columbia, Canada", "Capital, British Columbia". */
export function placeNameLong(key: string, regions: Names): string {
  const up = parentKey(key)
  const own = placeName(key, regions)
  return up ? `${own}, ${placeName(up, regions)}` : own
}
