// What the Places, Time and Status buttons in the controls bar say about the active filter, and the places and
// status labels the share image uses. Pure, so the bar, the share image and the tests agree.
import { IUCN_NAMES, THREATENED, type IucnCat } from '@/lib/species/iucn'
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

/** The Status button's short summary: the number of checked categories ("2"), or undefined for none. */
export function statusSummary(f: Filter): string | undefined {
  return f.statuses?.length ? String(f.statuses.length) : undefined
}

/** The Status button's accessible description: the full names in `IUCN_CATS` order ("Vulnerable, Endangered"). */
export function statusSpoken(f: Filter): string | undefined {
  return f.statuses?.length ? f.statuses.map((c) => IUCN_NAMES[c]).join(', ') : undefined
}

/**
 * The share image's status label: exactly Vulnerable, Endangered and Critically Endangered read "Threatened"; else
 * worded as `countriesLabel`: "Endangered", "Vulnerable + Endangered", "Near Threatened and 3 more"; undefined for none.
 */
export function statusLabel(statuses: readonly IucnCat[] | undefined): string | undefined {
  if (statuses?.length === THREATENED.length && THREATENED.every((c) => statuses.includes(c))) return 'Threatened'
  return countriesLabel(statuses, (c) => IUCN_NAMES[c as IucnCat])
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
  const full = saved.records.ebird ?? []
  return full.length && !full.some((r) => Array.isArray(r.seen)) ? 'reimport' : 'add'
}
