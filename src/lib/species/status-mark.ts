// The Red List pill on a threatened bird (VU, EN, CR) in the List view's rows (item 3, Yusuf 2026-11-15). The collage's
// stickers carry none (they overlapped neighbours; Yusuf 2026-11-15).
import { THREATENED, type IucnCat } from './iucn'

/** Does a row with this category carry the pill? Threatened species only (VU, EN, CR); none without a category. */
export function markShown(iu: IucnCat | undefined): iu is IucnCat {
  return !!iu && THREATENED.includes(iu)
}

/**
 * The share image's pill is drawn at the screen mark's size (status-mark.css: .eb-smark: two mono letters at 9px, about
 * 21px wide, in CSS px), left off a sticker whose longest side is under `minSide`, inset from its box's bottom-right
 * corner, and kept `MARK_COUNT_AIR_PX` clear of the count's text.
 */
export const MARK_PX = { w: 22, h: 14, minSide: 32 } as const
export const MARK_INSET_PX = 2
/** Air kept between a mark and the count's text, CSS px. */
export const MARK_COUNT_AIR_PX = 3
