'use client'
// The Places panel's body (the Places dropdown in FilterDropdowns.tsx): the lifer-only note, then the places in the
// design the preview switch picks (`places`, src/lib/variants.ts; a, the default: PlacesDrill.tsx, one level at a
// time drilled in place; b: PlacesTree.tsx, one checklist whose rows expand inline). What every design shares lives in
// places-shared.tsx: a level's rows, one checkbox row, the search field, the level's words. Every design writes the
// filter only through togglePlace / withPlaces (filters.ts) and keeps the same test ids: `country-<ISO2>` and
// `place-<key>` checkboxes, `drill-<key>` buttons.
import Link from '@/components/app/IntentLink'
import { MYEBIRDDATA_PLACES, type FullPlacesSource } from '@/lib/list/filter-summary'
import { useVariant } from '@/lib/variants'
import type { PlacesBodyProps, PlacesNote } from './places-shared'
import { PlacesDrill } from './PlacesDrill'
import { PlacesTree } from './PlacesTree'

/** The Places panel's designs, the default first: a drills in place (PlacesDrill), b expands rows inline (PlacesTree). */
export const PLACES_VARIANTS = ['a', 'b'] as const

export function PlacesList({ note, ...body }: PlacesBodyProps & { note?: PlacesNote }) {
  const variant = useVariant('places', PLACES_VARIANTS)
  return (
    <div className="eb-places">
      {note && <PlacesNoteLine note={note} />}
      {variant === 'a' ? <PlacesDrill {...body} /> : <PlacesTree {...body} />}
    </div>
  )
}

/** Places only knows each bird's first place, and a link to the Add panel of the file that knows every place. */
export function PlacesNoteLine({ note, source = MYEBIRDDATA_PLACES }: { note: PlacesNote; source?: FullPlacesSource }) {
  const again = note === 'reimport'
  return (
    <p className="eb-note eb-places-note" data-testid="places-lifer-only">
      Places only knows where each bird was first seen.{' '}
      <Link href={`/settings#${source.anchor}`}>{again ? source.again : source.add}</Link>
      {' '}to filter by every place you saw each bird{again ? '' : `, ${source.reach}`}.
    </p>
  )
}
