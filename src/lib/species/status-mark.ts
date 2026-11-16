// The Red List pill on a threatened bird (VU, EN, CR) in the collage and the list view (item 3, Yusuf 2026-11-15).
// Which birds carry one, and which of those the collage leaves unmarked: a sticker too small to carry it, or one
// whose corner would sit on the count's text. Pure: Collage calls hiddenMarks once per layout, never per frame.
import { LAYOUTS } from '@/lib/layout/constants'
import { collageHole, touchesHole, type Rect } from '@/lib/layout/count-box'
import { IUCN_NAMES, THREATENED, type IucnCat } from './iucn'

/** Does a bird with this category carry the mark? Threatened species only (VU, EN, CR); none without a category. */
export function markShown(iu: IucnCat | undefined): iu is IucnCat {
  return !!iu && THREATENED.includes(iu)
}

/** The bird's accessible name: the common name, then the status when it carries the mark ("Snowy Owl, Vulnerable"). */
export const markedName = (name: string, iu: IucnCat | undefined): string =>
  markShown(iu) ? `${name}, ${IUCN_NAMES[iu]}` : name

/**
 * The mark's size in CSS px (status-mark.css: .eb-status: two mono letters at 9px, about 21px wide), the sticker's
 * longest side below which a bird goes unmarked, and the inset from the box's bottom-right corner.
 */
export const MARK_PX = { w: 22, h: 14, minSide: 32 } as const
export const MARK_INSET_PX = 2
/** Air kept between a mark and the count's text, CSS px. */
export const MARK_COUNT_AIR_PX = 3

type Box = readonly [x: number, y: number, w: number, h: number]
export type MarkLayout = { layout: string; W: number; H: number; boxes: ReadonlyMap<string, Box> }

/** A mark's rectangle in layout units about the stage's centre (where the count sits), at `stagePx` CSS px wide. */
export function markRect(box: Box, W: number, H: number, stagePx: number): Rect {
  const u = W / stagePx
  const { w, h } = MARK_PX
  const r = box[0] + box[2] - MARK_INSET_PX * u, b = box[1] + box[3] - MARK_INSET_PX * u
  return [r - w * u - W / 2, b - h * u - H / 2, r - W / 2, b - H / 2]
}

/**
 * The shown birds whose mark is left out: the sticker's longest side is under the kind's minimum, or the mark's
 * rectangle comes within MARK_COUNT_AIR_PX of the count's text (the packer keeps silhouettes off the count, not boxes,
 * so a box's corner can sit over it). `count` is the number shown (the count's text); `cat` says each bird's category.
 */
export function hiddenMarks(a: {
  layout: MarkLayout
  visible: ReadonlySet<string>
  cat: (code: string) => IucnCat | undefined
  stagePx: number
  count: number
}): Set<string> {
  const { layout, visible, cat, stagePx, count } = a
  const out = new Set<string>()
  if (!(stagePx > 0)) return out
  const spec = LAYOUTS.find((l) => l.name === layout.layout)
  const u = layout.W / stagePx
  const hole = spec ? collageHole(count, { W: layout.W, F: spec.F, minWidth: spec.minWidth, maxWidth: spec.maxWidth }) : undefined
  const near = hole && { ...hole, pad: MARK_COUNT_AIR_PX * u }
  for (const code of visible) {
    if (!markShown(cat(code))) continue
    const box = layout.boxes.get(code)
    if (!box) continue
    if (Math.max(box[2], box[3]) / u < MARK_PX.minSide) { out.add(code); continue }
    if (near && touchesHole(markRect(box, layout.W, layout.H, stagePx), near)) out.add(code)
  }
  return out
}
