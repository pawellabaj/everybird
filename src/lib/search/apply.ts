// Item 9, part D: what the search's "Understood as" chips do. Pure. The parser (smart.ts) reads the query; these helpers
// pick the chips the search shows, give the bird-name words left over, and turn the chips into one filter.
import { clearPlaces, withPlaces, withStatuses, type Filter } from '../list/filters'
import { timeless } from '../list/timeline'
import type { SpeciesIndex } from '../species/load'
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
 * The filter the chips ask for. For each kind the query sets, the fields that kind owns are replaced and the rest
 * stay: places (one dimension, so a continent picked before goes too), the time range and its basis, the group, the
 * Red List categories. A kind the query doesn't set leaves its fields alone. With `species`, a group drops an order or
 * family that lies outside its bounds (as `drillTo` clears what would leave nothing), so the collage is never empty by it.
 */
export function applySmart(current: Filter, found: SmartFilter, kinds: ReadonlySet<Chip['kind']>, species?: SpeciesIndex): Filter {
  let next: Filter = { ...current }
  if (kinds.has('place')) {
    next = withPlaces(clearPlaces(next), [
      ...(found.countries ?? []).map((c) => `c:${c}`),
      ...(found.provinces ?? []).map((s) => `s:${s}`),
      ...(found.counties ?? []).map((k) => `k:${k}`),
    ])
  }
  if (kinds.has('date')) {
    next = timeless(next)
    if (found.from) next.from = found.from
    if (found.to) next.to = found.to
  }
  if (kinds.has('date') || kinds.has('basis')) {
    if (found.basis) next.basis = found.basis
    else delete next.basis
  }
  if (kinds.has('group')) {
    if (found.group) {
      next.group = found.group
      const g = species?.groups?.get(found.group)
      if (g) {
        const inside = (r: { to: number }) => r.to >= g.lo && r.to <= g.hi
        if (next.order && !species!.rows.some((r) => r.ord === next.order && inside(r))) { delete next.order; delete next.family }
        if (next.family && !species!.rows.some((r) => r.fam === next.family && inside(r))) delete next.family
      }
    } else delete next.group
  }
  if (kinds.has('status')) {
    next = withStatuses(next, (found.statuses ?? []).filter((c) => isStatusFilterCat(c)))
  }
  return next
}
