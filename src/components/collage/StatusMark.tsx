// A threatened bird's Red List pill in the List view's rows (src/lib/species/status-mark.ts): a small
// pill with the abbreviation in the chart's fixed fill and text, ringed in Line.
// Decoration beside words that name the category (the row's hidden text), so aria-hidden.
import type { IucnCat } from '@/lib/species/iucn'
import './status-mark.css'

export function StatusMark({ cat }: { cat: IucnCat }) {
  return (
    <span className="eb-smark" data-cat={cat} aria-hidden="true">
      {cat}
    </span>
  )
}
