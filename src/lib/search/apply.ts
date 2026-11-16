// Item 9, part D: what the search's "Understood as" chips do. Pure. The parser (smart.ts) reads the query; these helpers
// pick the chips the search shows, give the bird-name words left over, and turn the chips into one filter.
import { clearPlaces, withPlaces, withStatuses, type Filter } from '../list/filters'
import { isStatusFilterCat } from '../species/status-filter'
import type { Chip, SmartFilter } from './smart'

/**
 * The kinds the search shows as chips. An order or a family the query names stays a bird-name hit, as it always was
 * (the list's picks), so its words are never taken out of the name search.
 */
const SHOWN: ReadonlySet<Chip['kind']> = new Set(['date', 'place', 'group', 'status', 'basis'])

export function shownChips(chips: readonly Chip[]): Chip[] {
  return chips.filter((c) => SHOWN.has(c.kind))
}

/** The query without the shown chips' words (their exact spans, from the parser): what bird names search for. */
export function nameQuery(query: string, chips: readonly Chip[]): string {
  let out = query
  for (const c of shownChips(chips).sort((a, b) => b.start - a.start)) out = `${out.slice(0, c.start)} ${out.slice(c.end)}`
  return out.replace(/\s+/g, ' ').trim()
}

/**
 * The filter the chips ask for. A search REPLACES every filter: it starts from nothing and sets only what the shown
 * chips say (places, the time range and its basis, the group, the Red List categories), so the previous search's and
 * the manual filters (an order or family, a time range, a continent) never stack onto it and empty the collage.
 * `_current` stays in the signature; it is not read.
 */
export function applySmart(_current: Filter, found: SmartFilter, kinds: ReadonlySet<Chip['kind']>): Filter {
  let next: Filter = {}
  if (kinds.has('place')) {
    next = withPlaces(clearPlaces(next), [
      ...(found.countries ?? []).map((c) => `c:${c}`),
      ...(found.provinces ?? []).map((s) => `s:${s}`),
      ...(found.counties ?? []).map((k) => `k:${k}`),
    ])
  }
  if (kinds.has('date')) {
    if (found.from) next.from = found.from
    if (found.to) next.to = found.to
  }
  if ((kinds.has('date') || kinds.has('basis')) && found.basis) next.basis = found.basis
  if (kinds.has('group') && found.group) next.group = found.group
  if (kinds.has('status')) {
    next = withStatuses(next, (found.statuses ?? []).filter((c) => isStatusFilterCat(c)))
  }
  return next
}
