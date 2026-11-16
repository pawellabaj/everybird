// What the Places, Time and Status buttons in the controls bar say about the active filter, and the places and
// status labels the share image uses. Pure, so the bar, the share image and the tests agree.
import { continentName, type ContinentId } from '@/lib/places/continents'
import { THREATENED } from '@/lib/species/iucn'
import { statusName, type StatusFilterCat } from '@/lib/species/status-filter'
import type { Regions } from '@/lib/species/types'
import { filterPlaceKeys, hasPlaces, type Filter } from './filters'
import { placeName, placeNameLong } from './place-keys'
import type { Saved } from './storage'
import { monthName, rangeLabel, rangeShort } from './timeline'

type Names = Pick<Regions, 'countries' | 'sub1'>

/** Names worded as a short list: "Canada", "Canada + Egypt", "Canada and 2 more"; undefined for none. */
export function namesLabel(names: readonly string[]): string | undefined {
  if (!names.length) return undefined
  const [first, second] = names
  if (names.length === 1) return first
  if (names.length === 2) return `${first} + ${second}`
  return `${first} and ${names.length - 1} more`
}

/** "Canada", "Canada + Egypt", "Canada and 2 more" (sorted as the filter keeps them); undefined for none. */
export function countriesLabel(countries: readonly string[] | undefined, name: (iso2: string) => string): string | undefined {
  return countries?.length ? namesLabel(countries.map(name)) : undefined
}

/** The names of a filter's continents, in CONTINENTS order (the filter keeps them so). */
export function continentNames(continents: readonly ContinentId[] | undefined): string[] {
  return (continents ?? []).map(continentName)
}

/**
 * The share image's places at every level by their short names, worded as `countriesLabel`, continents first:
 * "Africa + Canada", "British Columbia", "Kenya + British Columbia", "Capital and 2 more" (keys in `filterPlaceKeys`
 * order); undefined for none.
 */
export function placesLabel(f: Filter, regions: Names): string | undefined {
  return namesLabel(filterPlaceKeys(f).map((k) => placeName(k, regions)))
}

/**
 * The Places button's accessible description of the filter, each place with its parent: "Canada, Egypt" for
 * countries only; "Kenya; British Columbia, Canada" once a province or county is in (the names hold commas). The
 * continents come first, as their own items: "Africa; Kenya, Egypt".
 */
export function placesSpoken(f: Filter, regions: Names): string | undefined {
  const keys = filterPlaceKeys(f).filter((k) => !k.startsWith('n:'))
  const continents = continentNames(f.continents)
  if (!keys.length && !continents.length) return undefined
  const sep = f.provinces?.length || f.counties?.length ? '; ' : ', '
  const items = keys.length ? [keys.map((k) => placeNameLong(k, regions)).join(sep)] : []
  return [...(continents.length ? [continents.join(', ')] : []), ...items].join('; ')
}

/** The Status button's accessible description: the full names in filter order ("Vulnerable, Endangered", "Not evaluated"). */
export function statusSpoken(f: Filter): string | undefined {
  return f.statuses?.length ? f.statuses.map(statusName).join(', ') : undefined
}

/**
 * The share image's status label: exactly Vulnerable, Endangered and Critically Endangered read "Threatened"; else
 * worded as `countriesLabel`: "Endangered", "Vulnerable + Endangered", "Near Threatened and 3 more"; undefined for none.
 */
export function statusLabel(statuses: readonly StatusFilterCat[] | undefined): string | undefined {
  if (statuses?.length === THREATENED.length && THREATENED.every((c) => statuses.includes(c))) return 'Threatened'
  return countriesLabel(statuses, (c) => statusName(c as StatusFilterCat))
}

/**
 * The Time chip's and button's short summary, `rangeShort` (the timeline's readout wording): "2022–2024" for whole
 * years, "Apr 2022–Sep 2024", "Sep 2021", "from Apr 2022", "to 2024"; undefined with no time chosen.
 */
export function timeSummary(f: Filter): string | undefined {
  return rangeShort(f.from, f.to)
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

export type CountWords = { one: string; other: string }

/** The count-first heads' words ("20 countries", "1 state or province", "5 categories"), one and other. */
export const COUNT_WORDS: Record<'continent' | 'country' | 'province' | 'county' | 'status', CountWords> = {
  continent: { one: 'continent', other: 'continents' },
  country: { one: 'country', other: 'countries' },
  province: { one: 'state or province', other: 'states and provinces' },
  county: { one: 'county', other: 'counties' },
  status: { one: 'category', other: 'categories' },
}

/** A panel section's head: the count first, then " · N checked" only when some are ("20 countries · 7 checked"). */
export function countHead(n: number, words: CountWords, checked: number): string {
  const head = `${n.toLocaleString('en-US')} ${n === 1 ? words.one : words.other}`
  return checked > 0 ? `${head} · ${checked.toLocaleString('en-US')} checked` : head
}

/** The Filters button, panel and chips' words, as `{n}` / `{label}` / `{species}` templates (see `fill`). */
export const FILTERS_UI = {
  button: 'Filters', dialog: 'Filters', chips: 'Active filters', close: 'Close',
  sections: { places: 'Places', time: 'Time', status: 'Conservation status' },
  species: '{n} species', head: 'Filters · {n} · {species}', headNone: 'Filters · {species}', show: 'Show {species}',
  manyPlaces: '{n} places', manyStatuses: '{n} statuses',
  openChip: 'Show {label} in Filters', clearChip: 'Remove all {label}',
} as const

/** Fills `{key}` in a template; an unknown key is left as it is. */
export function fill(t: string, vars: Record<string, string | number>): string {
  return t.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

/** The N in "Filters · N": the filter groups in use (Places, Time, Conservation status), 0 to 3, not checked boxes. */
export function filtersCount(f: Filter): number {
  return (hasPlaces(f) ? 1 : 0) + (f.from || f.to ? 1 : 0) + (f.statuses?.length ? 1 : 0)
}

/** The Filters button's accessible description: each section in use, "Places: Kenya. Time: March 2020 to June 2021"; undefined for none. */
export function filtersSpoken(f: Filter, regions: Names): string | undefined {
  const parts: string[] = []
  const places = placesSpoken(f, regions)
  if (places) parts.push(`${FILTERS_UI.sections.places}: ${places}`)
  const time = timeSpoken(f)
  if (f.from || f.to) parts.push(`${FILTERS_UI.sections.time}: ${time}`)
  const status = statusSpoken(f)
  if (status) parts.push(`${FILTERS_UI.sections.status}: ${status}`)
  return parts.length ? parts.join('. ') : undefined
}

const speciesOf = (shown: number) => fill(FILTERS_UI.species, { n: shown.toLocaleString('en-US') })

/** The panel's head: "Filters · 3 · 118 species", or "Filters · 118 species" with no filter in use. */
export function panelHead(n: number, shown: number): string {
  return n > 0 ? fill(FILTERS_UI.head, { n, species: speciesOf(shown) }) : fill(FILTERS_UI.headNone, { species: speciesOf(shown) })
}

/** The sheet's bottom button: "Show 118 species". */
export function showLabel(shown: number): string {
  return fill(FILTERS_UI.show, { species: speciesOf(shown) })
}
