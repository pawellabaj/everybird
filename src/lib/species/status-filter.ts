// The Conservation status filter's categories: the global IUCN Red List categories plus NE, "Not evaluated", for the
// species with no category (their `iu` is unset). NE is not in the data, so it lives here and not in iucn.ts: the
// data's categories, names and colours (IUCN_CATS, IUCN_NAMES, IUCN_COLORS) stay as they are, and a species row keeps
// its IucnCat type, so NE can reach only the filter's row and chips, never the card, tooltip or list rows.
import { IUCN_CATS, IUCN_COLORS, IUCN_NAMES, isIucnCat, type IucnCat } from './iucn'

export type StatusFilterCat = IucnCat | 'NE'

/** The filter's checklist order: the Red List categories in their order, then NE last (after DD). */
export const STATUS_FILTER_CATS: readonly StatusFilterCat[] = [...IUCN_CATS, 'NE']

export const NE_NAME = 'Not evaluated'
/**
 * NE's pill: a neutral grey (not a Red List colour, so not in IUCN_COLORS) with the same dark text as the grey DD fill,
 * 5.9:1 on it (AA), and the same 1px Line ring. Shown only in the filter's row and chips.
 */
export const NE_COLOR = { fill: '#9a9a94', text: '#1e1e24' } as const

export function isStatusFilterCat(x: unknown): x is StatusFilterCat {
  return x === 'NE' || isIucnCat(x)
}

/** The full name: the Red List category's, or "Not evaluated". */
export function statusName(cat: StatusFilterCat): string {
  return cat === 'NE' ? NE_NAME : IUCN_NAMES[cat]
}

/** The pill's colours: the Red List chart's for a category, NE_COLOR for NE. */
export function statusColor(cat: StatusFilterCat): { fill: string; text: string } {
  return cat === 'NE' ? NE_COLOR : IUCN_COLORS[cat]
}
