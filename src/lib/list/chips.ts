// The chip model: what an active filter (or, for item 9's smart search, an understood phrase) shows as a removable chip.
// Pure. `filterChips` reads a Filter into chips (places, time, statuses); `withoutFilterChip` removes one.
import { statusName } from '@/lib/species/status-filter'
import { continentName, isContinentId } from '@/lib/places/continents'
import type { Regions } from '@/lib/species/types'
import { clearPlaces, filterPlaceKeys, withContinents, withPlaces, withStatuses, type Filter } from './filters'
import { FILTERS_UI, fill, placesSpoken, timeSpoken, timeSummary } from './filter-summary'
import { placeName, placeNameLong } from './place-keys'
import { timeless } from './timeline'

/** Item 9's kinds, verbatim. */
export type ChipKind = 'date' | 'place' | 'group' | 'order' | 'family' | 'status' | 'basis'

/**
 * `token` is what the chip stands for: for a filter chip, the value it removes (a place key such as `c:CA`, a
 * continent as `continent:AF`, a category such as `VU`, `from..to` for time, or `ALL` for a collapsed chip). `spoken` is
 * its accessible name, when it differs.
 */
export type Chip = { kind: ChipKind; label: string; token: string; spoken?: string }

/** The token of a collapsed chip ("5 places"): every value of its kind. */
export const ALL = '*'
/** More values than this in one kind collapse to a single "N places" chip. */
export const MAX_CHIPS = 3

type Names = Pick<Regions, 'countries' | 'sub1'>

/** The token of a continent's chip. */
export const continentToken = (id: string) => `continent:${id}`

/**
 * The filter's chips: places (continents first, then the place keys in `filterPlaceKeys` order; a continent counts as
 * one place), then time, then statuses (in Red List order).
 */
export function filterChips(f: Filter, regions: Names): Chip[] {
  const out: Chip[] = []
  const keys = filterPlaceKeys(f)
  const continents = (f.continents ?? []).filter(isContinentId)
  const count = keys.length + continents.length
  if (count > MAX_CHIPS) {
    out.push({ kind: 'place', label: fill(FILTERS_UI.manyPlaces, { n: count }), token: ALL, spoken: placesSpoken(f, regions) })
  } else {
    for (const id of continents) out.push({ kind: 'place', label: continentName(id), token: continentToken(id) })
    for (const k of keys) out.push({ kind: 'place', label: placeName(k, regions), token: k, spoken: placeNameLong(k, regions) })
  }
  const time = timeSummary(f)
  if (time) out.push({ kind: 'date', label: time, token: `${f.from ?? ''}..${f.to ?? ''}`, spoken: timeSpoken(f) })
  const cats = f.statuses ?? []
  if (cats.length > MAX_CHIPS) {
    out.push({ kind: 'status', label: fill(FILTERS_UI.manyStatuses, { n: cats.length }), token: ALL })
  } else {
    for (const c of cats) out.push({ kind: 'status', label: statusName(c), token: c })
  }
  return out
}

/** The filter without what `chip` stands for; a chip of any other kind leaves it as it is. */
export function withoutFilterChip(f: Filter, chip: Chip): Filter {
  if (chip.kind === 'place' && chip.token === ALL) return clearPlaces(f)
  if (chip.kind === 'place' && chip.token.startsWith('continent:')) return withContinents(f, (f.continents ?? []).filter((c) => continentToken(c) !== chip.token))
  if (chip.kind === 'place') return withPlaces(f, filterPlaceKeys(f).filter((k) => k !== chip.token))
  if (chip.kind === 'date') return timeless(f)
  if (chip.kind === 'status') return withStatuses(f, chip.token === ALL ? [] : (f.statuses ?? []).filter((c) => c !== chip.token))
  return f
}
