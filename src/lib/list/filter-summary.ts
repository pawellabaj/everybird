// What the Places, Time and Status buttons in the controls bar say about the active filter, and the places and
// status labels the share image uses. Pure, so the bar, the share image and the tests agree.
import { fmt } from '@/i18n/core'
import type { Ui } from '@/i18n/messages/en'
import { THREATENED, type IucnCat } from '@/lib/species/iucn'
import type { Regions } from '@/lib/species/types'
import { filterPlaceKeys, type Filter } from './filters'
import { placeName, placeNameLong } from './place-keys'
import type { Saved } from './storage'
import { monthName, monthShort, rangeLabel } from './timeline'

type Names = Pick<Regions, 'countries' | 'sub1'>

/** "Canada", "Canada + Egypt", "Canada and 2 more" (sorted as the filter keeps them; `t.places.andMore`); undefined for none. */
export function countriesLabel(countries: readonly string[] | undefined, name: (iso2: string) => string, t: Pick<Ui, 'places'>): string | undefined {
  if (!countries?.length) return undefined
  const [first, second] = countries.map(name)
  if (countries.length === 1) return first
  if (countries.length === 2) return `${first} + ${second}`
  return fmt(t.places.andMore, { first, n: countries.length - 1 })
}

/**
 * The share image's places at every level by their short names, worded as `countriesLabel`: "British Columbia",
 * "Kenya + British Columbia", "Capital and 2 more" (in `filterPlaceKeys` order); undefined for none.
 */
export function placesLabel(f: Filter, regions: Names, t: Pick<Ui, 'places'>): string | undefined {
  const keys = filterPlaceKeys(f)
  return countriesLabel(keys, (k) => placeName(k, regions), t)
}

/** The Places button's short summary: the number of checked places at every level ("3"), or undefined for none. */
export function placesSummary(f: Filter): string | undefined {
  const n = filterPlaceKeys(f).length
  return n ? String(n) : undefined
}

/**
 * The Places button's accessible description of the filter, each place with its parent: "Canada, Egypt" for
 * countries only; "Kenya; British Columbia, Canada" once a province or county is in (the names hold commas). The names
 * are `regions`' (pass the language's country names, src/lib/i18n-places.ts regionsIn).
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

/** The Status button's accessible description: the full names in `IUCN_CATS` order ("Vulnerable, Endangered"), in `t`'s language. */
export function statusSpoken(f: Filter, t: Pick<Ui, 'iucn'>): string | undefined {
  return f.statuses?.length ? f.statuses.map((c) => t.iucn.names[c]).join(', ') : undefined
}

/**
 * The share image's status label: exactly Vulnerable, Endangered and Critically Endangered read "Threatened"; else
 * worded as `countriesLabel`: "Endangered", "Vulnerable + Endangered", "Near Threatened and 3 more"; undefined for none.
 */
export function statusLabel(statuses: readonly IucnCat[] | undefined, t: Pick<Ui, 'iucn' | 'places'>): string | undefined {
  if (statuses?.length === THREATENED.length && THREATENED.every((c) => statuses.includes(c))) return t.iucn.threatened
  return countriesLabel(statuses, (c) => t.iucn.names[c as IucnCat], t)
}

const year = (m: string) => m.slice(0, 4)

/**
 * The Time button's short summary: a range by years ("2022–2024", "2022" within one
 * year, "Sep 2021" for one month, "from 2022", "to 2024"); undefined with no time chosen.
 */
export function timeSummary(f: Filter, t: Ui): string | undefined {
  const { from, to } = f
  const tl = t.filters.timeline
  if (from && to) {
    if (from === to) return monthShort(from, t)
    return year(from) === year(to) ? year(from) : `${year(from)}–${year(to)}`
  }
  if (from) return fmt(tl.sumFrom, { year: year(from) })
  if (to) return fmt(tl.sumTo, { year: year(to) })
  return undefined
}

/** The Time button's accessible description: "March 2020 to June 2021", "September 2021". */
export function timeSpoken(f: Filter, t: Ui): string | undefined {
  const { from, to } = f
  const tl = t.filters.timeline
  if (from && to) return from === to ? monthName(from, t) : fmt(tl.range, { from: monthName(from, t), to: monthName(to, t) })
  if (from) return fmt(tl.spokenFrom, { month: monthName(from, t) })
  if (to) return fmt(tl.spokenUpTo, { month: monthName(to, t) })
  return rangeLabel(from, to, t)
}

/**
 * The file that knows every place each bird was recorded: Settings' anchor that opens its Add panel (EbirdDrop reads
 * it; the Places panel's note links to it). One source today (MyEBirdData); another plugs in as another of these. The
 * notes' words are the strings files': `ui.places.note` (the Places panel, and Settings' import-again line) and
 * `ui.import.ebird.liferNote` (Settings' lifer-only note); never "seen", since heard-only birds count too.
 */
export type FullPlacesSource = { anchor: string }
export const MYEBIRDDATA_PLACES: FullPlacesSource = { anchor: 'add-mydata' }

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
