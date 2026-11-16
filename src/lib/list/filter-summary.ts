// What the Places and Time buttons in the controls bar say about the active filter, and the places label the share
// image uses. Pure, so the bar, the share image and the tests agree.
import type { Regions } from '@/lib/species/types'
import { filterPlaceKeys, type Filter } from './filters'
import { placeName, placeNameLong } from './place-keys'
import type { Saved } from './storage'
import { monthName, monthShort, rangeLabel } from './timeline'

type Names = Pick<Regions, 'countries' | 'sub1'>

/** "Canada", "Canada + Egypt", "Canada and 2 more" (sorted as the filter keeps them); undefined for none. */
export function countriesLabel(countries: readonly string[] | undefined, name: (iso2: string) => string): string | undefined {
  if (!countries?.length) return undefined
  const [first, second] = countries.map(name)
  if (countries.length === 1) return first
  if (countries.length === 2) return `${first} + ${second}`
  return `${first} and ${countries.length - 1} more`
}

/**
 * The share image's places at every level by their short names, worded as `countriesLabel`: "British Columbia",
 * "Kenya + British Columbia", "Capital and 2 more" (in `filterPlaceKeys` order); undefined for none.
 */
export function placesLabel(f: Filter, regions: Names): string | undefined {
  const keys = filterPlaceKeys(f)
  return countriesLabel(keys, (k) => placeName(k, regions))
}

/** The Places button's short summary: the number of checked places at every level ("3"), or undefined for none. */
export function placesSummary(f: Filter): string | undefined {
  const n = filterPlaceKeys(f).length
  return n ? String(n) : undefined
}

/**
 * The Places button's accessible description of the filter, each place with its parent: "Canada, Egypt" for
 * countries only; "Kenya; British Columbia, Canada" once a province or county is in (the names hold commas).
 */
export function placesSpoken(f: Filter, regions: Names): string | undefined {
  const keys = filterPlaceKeys(f)
  if (!keys.length) return undefined
  const sep = f.provinces?.length || f.counties?.length ? '; ' : ', '
  return keys.map((k) => placeNameLong(k, regions)).join(sep)
}

const year = (m: string) => m.slice(0, 4)

/**
 * The Time button's short summary: a range by years ("2022–2024", "2022" within one
 * year, "Sep 2021" for one month, "from 2022", "to 2024"); undefined with no time chosen.
 */
export function timeSummary(f: Filter): string | undefined {
  const { from, to } = f
  if (from && to) {
    if (from === to) return monthShort(from)
    return year(from) === year(to) ? year(from) : `${year(from)}–${year(to)}`
  }
  if (from) return `from ${year(from)}`
  if (to) return `to ${year(to)}`
  return undefined
}

/** The Time button's accessible description: "March 2020 to June 2021", "September 2021". */
export function timeSpoken(f: Filter): string | undefined {
  const { from, to } = f
  if (from && to) return from === to ? monthName(from) : `${monthName(from)} to ${monthName(to)}`
  if (from) return `from ${monthName(from)}`
  if (to) return `up to ${monthName(to)}`
  return rangeLabel(from, to)
}

/**
 * What the lifer-only notes say about the file that knows every place each bird was seen: its Add link's and its
 * import-again link's words, how far down its places go, and Settings' anchor that opens its Add panel (EbirdDrop
 * reads it). One source today (MyEBirdData); another plugs in as another of these.
 */
export type FullPlacesSource = { add: string; again: string; reach: string; anchor: string }
export const MYEBIRDDATA_PLACES: FullPlacesSource = {
  add: 'Add MyEBirdData',
  again: 'Import MyEBirdData again',
  reach: 'down to the county',
  anchor: 'add-mydata',
}

/**
 * The Places panel's line about birds only on the observation.org life list ("Observed species": no places): what it
 * says, its link's words, and Settings' anchor that opens observation.org's observations Add panel.
 */
export const OBSORG_PLACES = {
  unplaced: 'Birds only on your observation.org life list have no places, so a place filter leaves them out.',
  add: 'Add the observations export',
  reach: 'to place them by country and province',
  anchor: 'add-obsorg',
} as const

/** The lifer-only notes' shared words (never "seen": heard-only birds count too, DESIGN.md "Voice and copy"). */
export const PLACES_FIRST_ONLY = 'Places only knows where you first recorded each bird.'
/** What the file that knows every place lets Places filter by: "to filter by every place you recorded each bird". */
export const PLACES_EVERY = 'every place you recorded each bird'

/**
 * Whether the Places dropdown says its places are only lifer places, and what to do: undefined for an empty list or
 * one with seen-here (some record knows every place a species was seen); 'reimport' when the MyEBirdData slot holds
 * records but none carries seen-here (an import saved before seen-here existed: importing the file again fills it);
 * else 'add' (bring MyEBirdData or iNaturalist).
 */
export function placesNoteFor(saved: Pick<Saved, 'records'>, listLength: number, seenFull: boolean): 'add' | 'reimport' | undefined {
  if (!listLength || seenFull) return undefined
  const { records } = saved
  const eBirdOrInat = !!(records.ebird?.length || records['ebird-list']?.length || records.inat?.length)
  const obsorg = !!(records.obsorg?.length || records['obsorg-list']?.length)
  if (!eBirdOrInat && obsorg) return undefined // the MyEBirdData pitch is only for eBird birders
  const full = records.ebird ?? []
  return full.length && !full.some((r) => Array.isArray(r.seen)) ? 'reimport' : 'add'
}

/** The Places panel's unplaced line: 'add' with its link to the observations' Add panel, 'plain' its first sentence
 *  only (the observations are on the list already, so adding them is no advice). */
export type PlacesUnplaced = 'add' | 'plain'

/**
 * Whether some bird on the observation.org life list ('obsorg-list', no places) has no record in any slot carrying a
 * place or seen-here: those birds drop out of any place filter, and the Places panel says so. An observations import
 * (or MyEBirdData, iNaturalist) that places the same birds turns it off for them. Birds the birder removed are off the
 * list and don't count; only records do (a hand tick in `edits.added` places nothing). With the observations on the
 * list (`records.obsorg`), the line has no link ('plain'); else 'add'. Undefined: no line.
 */
export function placesUnplacedFor(saved: Pick<Saved, 'records'> & { edits?: Pick<Saved['edits'], 'removed'> }): PlacesUnplaced | undefined {
  const removed = new Set(saved.edits?.removed ?? [])
  const listed = (saved.records['obsorg-list'] ?? []).filter((r) => !removed.has(r.code))
  if (!listed.length) return undefined
  const placed = new Set<string>()
  for (const recs of Object.values(saved.records)) {
    for (const r of recs ?? []) if (r.place || r.seen?.length) placed.add(r.code)
  }
  if (!listed.some((r) => !placed.has(r.code))) return undefined
  return saved.records.obsorg?.length ? 'plain' : 'add'
}
