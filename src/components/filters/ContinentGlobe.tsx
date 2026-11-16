import { CONTINENT_GLOBES, CONTINENT_VIEWBOX } from '@/lib/places/continent-shapes'
import type { ContinentId } from '@/lib/places/continents'

/**
 * A continent row's icon, in the place a country's flag takes: a small line-drawn globe (a circle with the continent's
 * land inside it), square, about 18px, centred in the flag's 18×13 slot. Muted; Ink while the row is ticked
 * (`.eb-check[data-checked]`). Decorative: the continent's name is always beside it.
 */
export function ContinentGlobe({ id }: { id: ContinentId }) {
  return (
    <span className="eb-flag-slot" aria-hidden="true">
      <svg className="eb-continent-globe" viewBox={CONTINENT_VIEWBOX} width={18} height={18} fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx={128} cy={128} r={112} fill="none" />
        <path d={CONTINENT_GLOBES[id]} fill="none" />
      </svg>
    </span>
  )
}
