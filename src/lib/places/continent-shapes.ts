// stub: replaced by scripts/build-data/build-continent-shapes.ts
// The land of each continent as an SVG path in a 256 × 256 box, drawn as lines inside a globe's circle (the continent
// row's icon in the Places panel, ContinentGlobe.tsx). Empty strings draw the circle alone.
import type { ContinentId } from './continents'

export const CONTINENT_VIEWBOX = '0 0 256 256'

export const CONTINENT_GLOBES: Record<ContinentId, string> = {
  AF: '',
  AS: '',
  EU: '',
  NA: '',
  SA: '',
  OC: '',
  AN: '',
}
