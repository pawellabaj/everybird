'use client'
// The Places panel, design a (the default): one level at a time, drilled in place. "12 countries" heads the
// countries; a row with places under it ends in a drill button (the site's chevron turned to point in). Drilled,
// the head names the level ("8 states and provinces", "14 counties"), the breadcrumb "All countries / Canada /
// British Columbia" steps back, and the first row, "All of Canada", is the parent's own checkbox. Drilling in
// focuses "All of …"; a step back focuses the drill button of the row it came from (scrolled into view); Esc closes the panel from any
// level (DropPanel). The search field and its query are per level.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon } from '@/components/collage/icons'
import { fmt } from '@/i18n/core'
import { useI18n } from '@/i18n/I18nProvider'
import { clearPlaces, filterPlaceKeys, hasPlaces, placeRows, togglePlace } from '@/lib/list/filters'
import { parentKey, placeName } from '@/lib/list/place-keys'
import { countHead } from '@/lib/list/filter-summary'
import { emptyHere, levelUnder, matchRows, PlaceCheck, placeCountsFor, PlacesFind, placeTestId, SEARCH_FROM, usePlaceRows, type PlacesBodyProps } from './places-shared'

export function PlacesDrill({ state, species, regions, onFilter }: PlacesBodyProps) {
  const { filter } = state
  const { t } = useI18n()
  // Opens at the selection's level: every checked place under one parent starts drilled there (the breadcrumb built),
  // so a checked province or county is in view; else (none, countries, or several parents) the countries.
  const [at, setAt] = useState<string | undefined>(() => startLevel(filterPlaceKeys(filter)))
  const [q, setQ] = useState('')
  // Test ids to focus, first found wins, once the new level has rendered (set by the drill and breadcrumb handlers).
  const focusNext = useRef<string[] | null>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const level = levelUnder(at)
  const counts = placeCountsFor(state, species)
  const rows = usePlaceRows(counts, filter, at, regions)
  const checked = useMemo(() => new Set(filterPlaceKeys(filter)), [filter])
  // "All of <parent>": the parent's own count, as its row one level up shows it (from the same counts).
  const allCount = useMemo(() => (at ? (placeRows(counts, parentKey(at), (k) => k).find((o) => o.value === at)?.count ?? 0) : 0), [at, counts])
  const path = useMemo(() => {
    const out: string[] = []
    for (let k = at; k; k = parentKey(k)) out.unshift(k)
    return out
  }, [at])

  const go = (next: string | undefined, focus: string[]) => {
    focusNext.current = focus
    setAt(next)
    setQ('')
  }
  // Back to `target`'s level (undefined: the countries): focus the drill button of the row the panel came from.
  const stepTo = (target: string | undefined) => {
    let k = at
    while (k && parentKey(k) !== target) k = parentKey(k)
    go(target, k ? [`drill-${k}`, placeTestId(k)] : [])
  }

  // Opened at the selection's level: the first checked row scrolled into the panel's view (focus stays with the panel).
  useLayoutEffect(() => {
    if (!at) return
    headRef.current?.closest<HTMLElement>('.eb-places')?.querySelector<HTMLElement>('.eb-places-level input:checked')?.scrollIntoView?.({ block: 'nearest' })
    // Only on opening: later levels place their own focus below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useLayoutEffect(() => {
    const ids = focusNext.current
    if (!ids) return
    focusNext.current = null
    const root = headRef.current?.closest<HTMLElement>('.eb-places')
    const body = root?.closest<HTMLElement>('.eb-drop-body')
    if (body) body.scrollTop = 0
    const all = Array.from(root?.querySelectorAll<HTMLElement>('[data-testid]') ?? [])
    const target = ids.map((id) => all.find((el) => el.dataset.testid === id)).find(Boolean) ?? root?.closest<HTMLElement>('[role="dialog"]')
    target?.focus({ preventScroll: true })
    // A step back to a row far down the level: scroll the body to it, so the focus is in view.
    target?.scrollIntoView?.({ block: 'nearest' })
  }, [at])

  const visible = rows.length > SEARCH_FROM ? matchRows(rows, q) : rows
  // Where some row drills, the others keep the button's room, so every count lines up.
  // At the counties the room is kept too, so the counts stay in the column they had a level up.
  const drills = level !== 'county' && rows.some((r) => r.children > 0)
  const gap = drills || level === 'county' ? <span className="eb-drill-space" aria-hidden="true" /> : null
  const drillLabel = (place: string) => fmt(level === 'country' ? t.places.drill.country : t.places.drill.province, { place })

  return (
    <>
      <div className="eb-places-head" ref={headRef}>
        <span className="eb-mono">{countHead(rows.length, level, rows.filter((r) => checked.has(r.value)).length, t)}</span>
        {hasPlaces(filter) && (
          <button type="button" className="eb-textbtn" data-testid="places-clear" onClick={() => onFilter(clearPlaces(filter))}>{t.filters.clear}</button>
        )}
      </div>
      {at && (
        <p className="eb-path eb-places-path" data-testid="places-path">
          {[undefined, ...path].map((k, i) => (
            <span key={k ?? ''} className="eb-path-item">
              {i > 0 && <span className="eb-path-sep" aria-hidden="true">/</span>}
              {k === at ? (
                <span aria-current="location">{placeName(k, regions)}</span>
              ) : (
                <button type="button" onClick={() => stepTo(k)}>{k ? placeName(k, regions) : t.places.allCountries}</button>
              )}
            </span>
          ))}
        </p>
      )}
      {rows.length > SEARCH_FROM && <PlacesFind level={level} q={q} onQ={setQ} />}
      {rows.length === 0 && !at ? (
        <p className="eb-note">{t.places.none}</p>
      ) : (
        <ul key={at ?? ''} className="eb-checklist eb-places-level" aria-label={t.places.head[level]}>
          {at && (
            <li className="eb-places-row">
              <PlaceCheck
                option={{ value: at, label: fmt(t.places.allOf, { place: placeName(at, regions) }), count: allCount, children: 0 }}
                checked={checked.has(at)}
                onToggle={() => onFilter(togglePlace(filter, at))}
                testId="place-all"
              />
              {gap}
            </li>
          )}
          {visible.map((r) => (
            <li key={r.value} className="eb-places-row">
              <PlaceCheck option={r} checked={checked.has(r.value)} onToggle={() => onFilter(togglePlace(filter, r.value))} flag={level === 'country'} />
              {drills && r.children > 0 ? (
                <button type="button" className="eb-drill" aria-label={drillLabel(r.label)} data-testid={`drill-${r.value}`} onClick={() => go(r.value, ['place-all'])}>
                  <ChevronDownIcon />
                </button>
              ) : gap}
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="eb-note eb-check-none" data-testid="places-empty">{emptyHere(filter, t)}</li>
          ) : visible.length === 0 && <li className="eb-note eb-check-none">{t.places.noMatch[level]}</li>}
        </ul>
      )}
    </>
  )
}

/** The parent every checked place shares, or undefined (countries) when there are none or they have several. */
export function startLevel(keys: string[]): string | undefined {
  if (!keys.length) return undefined
  const first = parentKey(keys[0])
  return keys.every((k) => parentKey(k) === first) ? first : undefined
}
