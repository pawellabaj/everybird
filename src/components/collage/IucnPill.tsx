// A global IUCN Red List category as a small pill in the Red List chart's colours (IUCN_COLORS): the fill and the
// text are fixed and the same in both themes; only the 1px Line ring follows the theme (card-list.css .eb-iucn).
// The span form is decoration beside words that already name the category (the Status panel's rows), so it is
// hidden from assistive tech. The button form is the bird card's (its toggletip comes with the card, BirdCard.tsx).
import type { CSSProperties } from 'react'
import { IUCN_COLORS, IUCN_NAMES, type IucnCat } from '@/lib/species/iucn'
import './card-list.css'

export function IucnPill({ cat, as = 'span' }: { cat: IucnCat; as?: 'span' | 'button' }) {
  const style = { '--iucn-fill': IUCN_COLORS[cat].fill, '--iucn-text': IUCN_COLORS[cat].text } as CSSProperties
  if (as === 'button') {
    return (
      <button type="button" className="eb-iucn" data-cat={cat} style={style} aria-label={`${cat}, ${IUCN_NAMES[cat]} (IUCN Red List)`} data-testid="iucn-pill">
        {cat}
      </button>
    )
  }
  return (
    <span className="eb-iucn" data-cat={cat} style={style} aria-hidden="true">
      {cat}
    </span>
  )
}
