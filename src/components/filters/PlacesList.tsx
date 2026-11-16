'use client'
// The Places panel's body (the Places dropdown in FilterDropdowns.tsx): the lifer-only note, then the places drilled
// in place, one level at a time (PlacesDrill.tsx; Yusuf chose the drill-down over expandable rows, 2026-11-15). What
// it shares lives in places-shared.tsx: a level's rows, one checkbox row, the search field, the level's words. The
// filter is written only through togglePlace / withPlaces (filters.ts); test ids: `country-<ISO2>` and `place-<key>`
// checkboxes, `drill-<key>` buttons.
import Link from '@/components/app/IntentLink'
import { rich } from '@/i18n/core'
import { useI18n } from '@/i18n/I18nProvider'
import { regionsIn } from '@/lib/i18n-places'
import { MYEBIRDDATA_PLACES, type FullPlacesSource } from '@/lib/list/filter-summary'
import type { PlacesBodyProps, PlacesNote } from './places-shared'
import { PlacesDrill } from './PlacesDrill'

export function PlacesList({ note, ...props }: PlacesBodyProps & { note?: PlacesNote }) {
  const { lang } = useI18n()
  // Countries named in the UI language (Intl.DisplayNames) for every row, the breadcrumb and the search.
  const body = { ...props, regions: regionsIn(props.regions, lang) }
  return (
    <div className="eb-places">
      {note && <PlacesNoteLine note={note} />}
      <PlacesDrill {...body} />
    </div>
  )
}

/** Places only knows each bird's first place, and a link to the Add panel of the file that knows every place (its
 *  anchor from `source`; the words, `t.places.note`, name MyEBirdData). */
export function PlacesNoteLine({ note, source = MYEBIRDDATA_PLACES }: { note: PlacesNote; source?: FullPlacesSource }) {
  const { t } = useI18n()
  return (
    <p className="eb-note eb-places-note" data-testid="places-lifer-only">
      {rich(t.places.note[note], { link: (chunk) => <Link href={`/settings#${source.anchor}`}>{chunk}</Link> })}
    </p>
  )
}
