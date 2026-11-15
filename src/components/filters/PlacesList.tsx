'use client'
// The Places panel's body (the Places dropdown in FilterDropdowns.tsx): the lifer-only note, then the places in the
// design the preview switch picks (`places`, src/lib/variants.ts; a, the default: PlacesDrill.tsx, one level at a
// time drilled in place). What every design shares lives here: a level's rows, one checkbox row, the search field, the
// level's words. Every design writes the filter only through togglePlace / withPlaces (filters.ts) and keeps the same
// test ids: `country-<ISO2>` and `place-<key>` checkboxes, `drill-<key>` buttons.
import Link from '@/components/app/IntentLink'
import { useMemo } from 'react'
import { SearchIcon } from '@/components/collage/icons'
import { Flag } from '@/components/Flag'
import { filterPlaceKeys, placeOptions, type Filter, type PlaceOption } from '@/lib/list/filters'
import { parentKey, parsePlaceKey, placeName, type PlaceLevel } from '@/lib/list/place-keys'
import type { AppState } from '@/lib/list/store'
import { searchKey } from '@/lib/species/name-search'
import type { SpeciesIndex } from '@/lib/species/load'
import type { Regions } from '@/lib/species/types'
import { useVariant } from '@/lib/variants'
import type { PlacesNote } from './FilterDropdowns'
import { PlacesDrill } from './PlacesDrill'

/** The Places panel's designs, the default first (Task 4b adds 'b', expandable rows). */
export const PLACES_VARIANTS = ['a'] as const

/** What a design of the panel gets. */
export type PlacesBodyProps = { state: AppState; species: SpeciesIndex; regions: Regions; onFilter: (f: Filter) => void }

export function PlacesList({ note, ...body }: PlacesBodyProps & { note?: PlacesNote }) {
  const variant = useVariant('places', PLACES_VARIANTS)
  return (
    <div className="eb-places">
      {note && <PlacesNoteLine note={note} />}
      {variant === 'a' && <PlacesDrill {...body} />}
    </div>
  )
}

/** "Showing each lifer's first place only", and how to get every place a species is on the list for. */
export function PlacesNoteLine({ note }: { note: PlacesNote }) {
  return (
    <p className="eb-note eb-places-note" data-testid="places-lifer-only">
      Showing each lifer&apos;s first place only.{' '}
      {note === 'reimport' ? (
        <><Link href="/settings">Import Download My Data again</Link> for full country lists.</>
      ) : (
        <><Link href="/settings">Add MyEBirdData or iNaturalist</Link> for full country lists.</>
      )}
    </p>
  )
}

/** The level of the places under `parent`: countries with none, a country's provinces, a province's counties. */
export function levelUnder(parent: string | undefined): PlaceLevel {
  if (parent === undefined) return 'country'
  return parsePlaceKey(parent)?.level === 'country' ? 'province' : 'county'
}

/** A level's head word, also its checklist's accessible name. */
export const LEVEL_HEAD: Record<PlaceLevel, string> = { country: 'Countries', province: 'States and provinces', county: 'Counties' }
const FIND: Record<PlaceLevel, string> = { country: 'Find a country', province: 'Find a state or province', county: 'Find a county' }
/** What a search that matches no row at the level says. */
export const NO_MATCH: Record<PlaceLevel, string> = { country: 'No country matches.', province: 'No state or province matches.', county: 'No county matches.' }

export const fmt = (x: number) => x.toLocaleString('en-US')

/**
 * The rows of the level under `parent` (placeOptions), and any checked place at that level they lack (another filter
 * left it no species), at 0, so it can still be unchecked.
 */
export function usePlaceRows(state: AppState, parent: string | undefined, regions: Regions, species: SpeciesIndex): PlaceOption[] {
  const { list, filter, seen } = state
  return useMemo(() => {
    const label = (k: string) => placeName(k, regions)
    const opts = placeOptions(list, filter, parent, species, label, seen)
    const have = new Set(opts.map((o) => o.value))
    const missing = filterPlaceKeys(filter)
      .filter((k) => parentKey(k) === parent && !have.has(k))
      .map((k): PlaceOption => ({ value: k, label: label(k), count: 0, children: 0 }))
    return [...opts, ...missing]
  }, [list, filter, parent, species, regions, seen])
}

/** The rows whose names hold every word of `q` as a word prefix, accent- and case-insensitive ("new z": New Zealand). */
export function matchRows<T extends { label: string }>(rows: T[], q: string): T[] {
  const key = searchKey(q)
  if (!key) return rows
  const terms = key.split(' ')
  return rows.filter((r) => {
    const ws = searchKey(r.label).split(' ')
    return terms.every((t) => ws.some((w) => w.startsWith(t)))
  })
}

/** A place's checkbox test id: `country-<ISO2>` for a country (as before levels), `place-<key>` below. */
export function placeTestId(key: string): string {
  const p = parsePlaceKey(key)
  return p?.level === 'country' ? `country-${p.country}` : `place-${key}`
}

type CheckProps = { option: PlaceOption; checked: boolean; onToggle: () => void; flag?: boolean; testId?: string }

/** One checklist row: the whole row is the label (box, flag on countries, name, Muted count, the spoken count). */
export function PlaceCheck({ option, checked, onToggle, flag, testId }: CheckProps) {
  const p = flag ? parsePlaceKey(option.value) : undefined
  return (
    <label className="eb-check" data-checked={checked ? '' : undefined}>
      <input type="checkbox" checked={checked} onChange={onToggle} data-testid={testId ?? placeTestId(option.value)} />
      {p && <Flag iso={p.country} />}
      <span className="eb-check-name">{option.label}</span>
      <span className="eb-count" aria-hidden="true">{fmt(option.count)}</span>
      <span className="eb-sr">, {fmt(option.count)} species</span>
    </label>
  )
}

/** The search field for a level with many rows: the app's one field style (globals.css .eb-input), the site's lens. */
export function PlacesFind({ level, q, onQ }: { level: PlaceLevel; q: string; onQ: (q: string) => void }) {
  return (
    <div className="eb-input-wrap">
      <SearchIcon className="eb-input-icon" />
      <input
        type="search"
        className="eb-input eb-input-search"
        placeholder={FIND[level]}
        aria-label={FIND[level]}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        value={q}
        onChange={(e) => onQ(e.target.value)}
        data-testid="places-find"
      />
    </div>
  )
}
