// A threatened bird's Red List pill in the collage and the list view (src/lib/species/status-mark.ts): a small
// pill with the abbreviation in the chart's fixed fill and text, ringed in Line.
// Decoration beside words that name the category (the bird's button name, the row's hidden text), so aria-hidden.
import type { IucnCat } from '@/lib/species/iucn'
import './status-mark.css'

export function StatusMark({ cat }: { cat: IucnCat }) {
  return (
    <span className="eb-status" data-cat={cat} aria-hidden="true">
      {cat}
    </span>
  )
}
