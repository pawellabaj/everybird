'use client'
// The Places panel's body (the Places section of Filters.tsx): the lifer-only note, then the places drilled in place,
// one level at a time from the continents down (PlacesDrill.tsx; Yusuf chose the drill-down over expandable rows,
// 2026-11-15, and continents as its top level over a chip row). What it shares lives in places-shared.tsx: a level's rows, one checkbox
// row, the search field, the level's words. The filter is written only through togglePlace / withPlaces
// (filters.ts); test ids: `continent-<ID>`, `country-<ISO2>` and `place-<key>` checkboxes, `drill-<key>` buttons.
import Link from '@/components/app/IntentLink'
import { MYEBIRDDATA_PLACES, PLACES_EVERY, PLACES_FIRST_ONLY, type FullPlacesSource } from '@/lib/list/filter-summary'
import type { PlacesBodyProps, PlacesNote } from './places-shared'
import { PlacesDrill } from './PlacesDrill'

export function PlacesList({ note, ...body }: PlacesBodyProps & { note?: PlacesNote }) {
  return (
    <div className="eb-places">
      {note && <PlacesNoteLine note={note} />}
      <PlacesDrill {...body} />
    </div>
  )
}

/** Places only knows each bird's first place, and a link to the Add panel of the file that knows every place. */
export function PlacesNoteLine({ note, source = MYEBIRDDATA_PLACES }: { note: PlacesNote; source?: FullPlacesSource }) {
  const again = note === 'reimport'
  return (
    <p className="eb-note eb-places-note" data-testid="places-lifer-only">
      {PLACES_FIRST_ONLY}{' '}
      <Link href={`/settings#${source.anchor}`}>{again ? source.again : source.add}</Link>
      {' '}to filter by {PLACES_EVERY}{again ? '' : `, ${source.reach}`}.
    </p>
  )
}
