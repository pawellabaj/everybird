'use client'
// Places, Time and Conservation status: dropdown buttons in the controls bar, between Scientific and the search. Each
// button says what it filters when active ("Places · 2", "Time · 2022–2024", "Conservation status · 2"; the bar's short
// form, under 540px of bar and on phones, reads "Status · 2", the accessible name stays whole), so the bar itself shows every active
// place, time or status filter;
// taxonomy sits under the bar (wrapped chips; the "Choose an order" picker on phones). A button opens its panel (one at a time; a second tap, Esc or a press outside
// closes it and focus returns to the button): a popover under the bar on wider screens, a bottom sheet on phones.
// Filters apply live.
//  - Places (PlacesList.tsx): checklists of places, one level at a time:
//    countries (flag, name, species seen there), then a country's states and provinces, then a province's counties,
//    each sorted by count; several places at any levels may be checked (the collage keeps species seen in ANY of them); Clear clears every level; a search field
//    once a level has more than SEARCH_FROM rows. A list whose places are all lifer places says so (PlacesNote).
//  - Time: the timeline (Timeline.tsx): month bars, a year axis, a range of months; Clear.
//  - Conservation status (StatusList.tsx): a checklist of global IUCN Red List categories with counts; Clear. Shown only when a
//    species on the list has a status (or one is checked), as `hide` leaves out what a shared link doesn't carry.
import { CalendarBlank, CaretDown, GlobeHemisphereWest } from '@phosphor-icons/react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { CloseIcon } from '@/components/collage/icons'
import { trapTab, useEscapeCapture, useFocusInAndBack, useHoldTopBar, useIsSheet } from '@/components/dialog-utils'
import { useI18n } from '@/i18n/I18nProvider'
import type { Ui } from '@/i18n/messages/en'
import { regionsIn } from '@/lib/i18n-places'
import { placesSpoken, placesSummary, statusSpoken, statusSummary, timeSpoken, timeSummary, type PlacesUnplaced } from '@/lib/list/filter-summary'
import type { Filter } from '@/lib/list/filters'
import type { ListEntry } from '@/lib/list/model'
import type { Action, AppState } from '@/lib/list/store'
import type { Month } from '@/lib/list/timeline'
import type { SpeciesIndex } from '@/lib/species/load'
import type { Regions } from '@/lib/species/types'
import { PlacesList } from './PlacesList'
import { STATUS_ICON } from './status-icon'
import type { PlacesNote } from './places-shared'
import { StatusList } from './StatusList'
import { Timeline } from './Timeline'
import './filters.css'

export type Panel = 'places' | 'time' | 'status'
// The lifer-only notice's kinds and the search field's threshold live with the Places panel (places-shared.tsx).
export { SEARCH_FROM, type PlacesNote } from './places-shared'

type Props = {
  state: AppState
  dispatch: (a: Action) => void
  species: SpeciesIndex
  regions: Regions
  /** The open panel (one at a time), kept by the parent. */
  open: Panel | null
  onOpen: (p: Panel | null) => void
  /** Buttons to leave out (a shared link that carries no places or dates). Status also hides itself on a list with no statuses. */
  hide?: readonly Panel[]
  placesNote?: PlacesNote
  /** Some birds on the observation.org life list have no places: the Places panel says so (the birder's own collage). */
  placesUnplaced?: PlacesUnplaced
  /** The Time panel's timeline: the known entries, the whole list's months, today. */
  time: { entries: ListEntry[]; months: Month[]; today: Month; onPreview?: (r: { from?: Month; to?: Month } | null) => void }
  /** The search covers the bar: the buttons are inert. */
  inert?: boolean
  /** The list's threatened count for the Status panel's line (the `threat` variant c; otherwise on the stats line). */
  threatLine?: number
}

/** The panels, Places first; their names from `t.filters` (`short`: the bar's short form under 540px of bar). */
const panels = (t: Ui): { id: Panel; label: string; short?: string; Icon: typeof GlobeHemisphereWest }[] => [
  { id: 'places', label: t.filters.places, Icon: GlobeHemisphereWest },
  { id: 'time', label: t.filters.time, Icon: CalendarBlank },
  { id: 'status', label: t.filters.status, short: t.filters.statusShort, Icon: STATUS_ICON },
]

export function FilterDropdowns({ state, dispatch, species, regions, open, onOpen, hide, placesNote, placesUnplaced, time, inert, threatLine }: Props) {
  const base = useId()
  const sheet = useIsSheet()
  const { lang, t } = useI18n()
  const { filter } = state
  const buttons = useRef<Partial<Record<Panel, HTMLButtonElement | null>>>({})
  // Status only when some species on the list has one, or a category is checked (so it can be cleared).
  const listHasStatus = useMemo(() => state.list.some((e) => species.byCode.get(e.code)?.iu), [state.list, species])
  const hasStatus = listHasStatus || !!filter.statuses?.length
  const shown = panels(t).filter((p) => !hide?.includes(p.id) && (p.id !== 'status' || hasStatus))
  const current = shown.find((p) => p.id === open)
  if (!shown.length) return null
  const onFilter = (f: Filter) => dispatch({ type: 'filter', filter: f })

  const summary = (p: Panel) => (p === 'places' ? placesSummary(filter) : p === 'time' ? timeSummary(filter, t) : statusSummary(filter))
  const spoken = (p: Panel) => (p === 'places' ? placesSpoken(filter, regionsIn(regions, lang)) : p === 'time' ? timeSpoken(filter, t) : statusSpoken(filter, t))

  return (
    <>
      <div className="eb-dock-filters" role="group" aria-label={t.filters.dock} inert={inert}>
        {shown.map(({ id, label, short, Icon }) => {
          const s = summary(id)
          const said = spoken(id)
          return (
            <button
              key={id}
              ref={(el) => { buttons.current[id] = el }}
              type="button"
              className="eb-dock-tab eb-dock-drop"
              aria-expanded={open === id}
              aria-controls={open === id ? `${base}-${id}` : undefined}
              aria-haspopup="dialog"
              aria-label={said ? `${label}: ${said}` : label}
              data-active={s ? '' : undefined}
              data-drop={id}
              data-testid={`filter-tab-${id}`}
              onClick={() => onOpen(open === id ? null : id)}
            >
              <Icon aria-hidden="true" focusable="false" />
              <span className="eb-drop-label">
                {short ? (
                  <>
                    <span className="eb-long">{label}</span>
                    <span className="eb-short" aria-hidden="true">{short}</span>
                  </>
                ) : label}
                {s && <span className="eb-drop-sum"> · {s}</span>}
              </span>
              <CaretDown aria-hidden="true" focusable="false" className="eb-drop-caret" />
            </button>
          )
        })}
      </div>
      {current && (
        <DropPanel
          key={current.id}
          id={`${base}-${current.id}`}
          kind={current.id}
          title={current.label}
          sheet={sheet}
          button={() => buttons.current[current.id] ?? null}
          onClose={() => onOpen(null)}
        >
          {current.id === 'places' ? (
            <PlacesList state={state} species={species} regions={regions} note={placesNote} unplaced={placesUnplaced} onFilter={onFilter} />
          ) : current.id === 'status' ? (
            <StatusList state={state} species={species} threatLine={threatLine} onFilter={onFilter} />
          ) : (
            <Timeline
              entries={time.entries}
              seen={state.seen}
              filter={filter}
              species={species}
              months={time.months}
              today={time.today}
              onFilter={onFilter}
              onPreview={time.onPreview}
            />
          )}
        </DropPanel>
      )}
    </>
  )
}

type PanelProps = { id: string; kind: Panel; title: string; sheet: boolean; button: () => HTMLButtonElement | null; onClose: () => void; children: ReactNode }

/** A popover under the bar (non-modal: a press outside closes it) or, on phones, a modal bottom sheet. */
function DropPanel({ id, kind, title, sheet, button, onClose, children }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useI18n()
  useEscapeCapture(onClose)
  useFocusInAndBack(ref, button)
  // Shown, the top bar must not cover the popover or its controls bar (a sheet sits above it anyway).
  useHoldTopBar(() => (sheet ? null : ref.current?.closest<HTMLElement>('.eb-dockwrap')))
  // A press outside the popover and its button closes it (the sheet has its scrim).
  useEffect(() => {
    if (sheet) return
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || button()?.contains(t)) return
      onClose()
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [sheet, button, onClose])

  const body = (
    <div
      ref={ref}
      id={id}
      className={sheet ? 'eb-sheet eb-drop-sheet' : 'eb-drop'}
      role="dialog"
      aria-modal={sheet ? true : undefined}
      aria-label={title}
      tabIndex={-1}
      data-kind={kind}
      data-testid={`filter-panel-${kind}`}
      onKeyDown={sheet ? (e) => trapTab(e, ref.current) : undefined}
    >
      {sheet && (
        <div className="eb-sheet-head">
          <span className="eb-mono">{title}</span>
          <button type="button" className="eb-sheet-close" aria-label={t.collage.close} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      )}
      <div className="eb-drop-body">{children}</div>
    </div>
  )
  // The sheet goes to <body>: the bar is a size container, which would otherwise be the fixed sheet's containing block.
  return sheet
    ? createPortal(<div className="eb-sheet-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>{body}</div>, document.body)
    : body
}
