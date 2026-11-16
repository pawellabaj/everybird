'use client'
// One Filters button in the controls bar and one panel behind it (item 10). The button ("Filters · 2": how many of Places,
// Time and Conservation status are in use, not checked boxes) sits where the three dropdown buttons did. It opens one
// panel holding the three sections, each keeping its own control: Time (Timeline.tsx) across the top, Places
// (PlacesList.tsx, the drill-down) about 2/3 and Conservation status (StatusList.tsx) 1/3 beside each other below it. From
// 600px the panel is a popover under the chip row (or under the dock with none), inside `.eb-dockwrap`; everything
// after the dock wrap dims and goes inert while it is open (CollageView's `.eb-view-below`), and a press there, Esc or a
// second press of the button closes it. On phones it is the modal bottom sheet, its head the count of species and its
// bottom button "Show N species". Filters apply live. The active filters show as chips under the dock (ChipRow.tsx).
// The head strings live in filter-summary.ts (FILTERS_UI), so the i18n branch can lift them in one move.
import { CalendarBlank, CaretDown, GlobeHemisphereWest } from '@phosphor-icons/react'
import { createPortal } from 'react-dom'
import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { CloseIcon, FilterLinesIcon } from '@/components/collage/icons'
import { trapTab, useEscapeCapture, useFocusInAndBack, useHoldTopBar, useIsSheet } from '@/components/dialog-utils'
import { filterChips, withoutFilterChip } from '@/lib/list/chips'
import { FILTERS_UI, filtersCount, filtersSpoken, panelHead, showLabel } from '@/lib/list/filter-summary'
import type { Filter } from '@/lib/list/filters'
import type { ListEntry } from '@/lib/list/model'
import type { Action, AppState } from '@/lib/list/store'
import type { Month } from '@/lib/list/timeline'
import type { SpeciesIndex } from '@/lib/species/load'
import type { Regions } from '@/lib/species/types'
import { ChipRow } from './ChipRow'
import { PlacesList } from './PlacesList'
import { STATUS_ICON } from './status-icon'
import type { PlacesNote } from './places-shared'
import { StatusList } from './StatusList'
import { Timeline } from './Timeline'
import './filters.css'

export type FilterSection = 'places' | 'time' | 'status'
/** Open: from the button (at undefined: focus the dialog) or a collapsed chip (focus that section). */
export type FiltersOpen = { at?: FilterSection }
// The lifer-only notice's kinds and the search field's threshold live with the Places panel (places-shared.tsx).
export { SEARCH_FROM, type PlacesNote } from './places-shared'

export const SECTION_ORDER: readonly FilterSection[] = ['time', 'places', 'status']
const ICONS: Record<FilterSection, typeof GlobeHemisphereWest> = { places: GlobeHemisphereWest, time: CalendarBlank, status: STATUS_ICON }

/** The sections shown: SECTION_ORDER less `hide`, and Status only when a species on the list has a status or one is checked. */
export function useFilterSections(state: AppState, species: SpeciesIndex, hide?: readonly FilterSection[]): FilterSection[] {
  const listHasStatus = useMemo(() => state.list.some((e) => species.byCode.get(e.code)?.iu), [state.list, species])
  const hasStatus = listHasStatus || !!state.filter.statuses?.length
  return useMemo(
    () => SECTION_ORDER.filter((s) => !hide?.includes(s) && (s !== 'status' || hasStatus)),
    [hide, hasStatus],
  )
}

type Shared = {
  state: AppState
  regions: Regions
  sections: readonly FilterSection[]
  open: FiltersOpen | null
  onOpen: (o: FiltersOpen | null) => void
}

/** In the dock's `filters` slot. Renders null when `sections` is empty. */
export function FiltersButton({ state, regions, sections, open, onOpen, inert, buttonRef, panelId }: Shared & { inert?: boolean; buttonRef: RefObject<HTMLButtonElement | null>; panelId: string }): ReactNode {
  if (!sections.length) return null
  const n = filtersCount(state.filter)
  const said = filtersSpoken(state.filter, regions)
  return (
    <div className="eb-dock-filters" inert={inert}>
      <button
        ref={buttonRef}
        type="button"
        className="eb-dock-tab eb-dock-drop"
        aria-expanded={!!open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        aria-label={said ? `${FILTERS_UI.button}: ${said}` : FILTERS_UI.button}
        data-active={n > 0 ? '' : undefined}
        data-testid="filters-button"
        onClick={() => onOpen(open ? null : {})}
      >
        <FilterLinesIcon />
        <span className="eb-drop-label">
          {FILTERS_UI.button}
          {n > 0 && <span className="eb-drop-sum"> · {n}</span>}
        </span>
        <CaretDown aria-hidden="true" focusable="false" className="eb-drop-caret" />
      </button>
    </div>
  )
}

const PlacesSection = memo(PlacesList)
const StatusSection = memo(StatusList)

type PanelProps = Shared & {
  dispatch: (a: Action) => void
  species: SpeciesIndex
  id: string
  buttonRef: RefObject<HTMLButtonElement | null>
  /** Where focus goes on close, if still connected (the chip that opened it); else the Filters button. */
  returnFocus?: () => HTMLElement | null
  placesNote?: PlacesNote
  time: { entries: ListEntry[]; months: Month[]; today: Month; onPreview?: (r: { from?: Month; to?: Month } | null) => void }
  threatLine?: number
  /** Species under the whole filter (CollageView's shownList.length): the head and the sheet's button. */
  shown: number
}

/** In ControlsBar's `below` slot, after the chip row (the popover anchors under it), or portalled as the sheet. */
export function FiltersPanel({ state, dispatch, species, regions, sections, open, onOpen, id, buttonRef, returnFocus, placesNote, time, threatLine, shown }: PanelProps): ReactNode {
  const sheet = useIsSheet()
  const ref = useRef<HTMLDivElement>(null)
  const titles = useId()
  const { filter } = state
  const onClose = useCallback(() => onOpen(null), [onOpen])
  const onFilter = useCallback((f: Filter) => dispatch({ type: 'filter', filter: f }), [dispatch])
  useEscapeCapture(onClose)
  useFocusInAndBack(ref, () => {
    const el = returnFocus?.()
    return el?.isConnected ? el : buttonRef.current
  })
  // Shown, the top bar must not cover the popover or its controls bar (a sheet sits above it anyway).
  useHoldTopBar(() => (sheet ? null : ref.current?.closest<HTMLElement>('.eb-dockwrap')))
  // Opened from a collapsed chip (or pressed again while open): focus goes to that section.
  useLayoutEffect(() => {
    if (!open?.at) return
    const el = ref.current?.querySelector<HTMLElement>(`[data-testid="filter-panel-${open.at}"]`)
    if (!el) return
    el.focus({ preventScroll: true })
    if (sheet) el.scrollIntoView?.({ block: 'nearest' })
  }, [open, sheet])
  // A press outside the dock wrap (the dock, the chips and the panel itself stay live) closes the popover; the sheet has its scrim.
  useEffect(() => {
    if (sheet) return
    const down = (e: PointerEvent) => {
      const wrap = ref.current?.closest('.eb-dockwrap')
      if (wrap?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [sheet, onClose])

  const n = filtersCount(filter)
  const head = panelHead(n, shown)
  const section = (s: FilterSection) => {
    const Icon = ICONS[s]
    return (
      <div key={s} className="eb-fsec" role="group" aria-labelledby={`${titles}-${s}`} tabIndex={-1} data-sec={s} data-testid={`filter-panel-${s}`}>
        <h3 id={`${titles}-${s}`} className="eb-mono eb-fsec-title">
          <Icon aria-hidden="true" focusable="false" />
          {FILTERS_UI.sections[s]}
        </h3>
        {s === 'places' ? (
          <PlacesSection state={state} species={species} regions={regions} note={placesNote} onFilter={onFilter} />
        ) : s === 'status' ? (
          <StatusSection state={state} species={species} threatLine={threatLine} onFilter={onFilter} />
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
      </div>
    )
  }
  const has = (s: FilterSection) => sections.includes(s)
  const lower = (['places', 'status'] as const).filter(has)

  const body = (
    <div
      ref={ref}
      id={id}
      className={sheet ? 'eb-sheet eb-drop-sheet' : 'eb-drop'}
      role="dialog"
      aria-modal={sheet ? true : undefined}
      aria-label={FILTERS_UI.dialog}
      tabIndex={-1}
      data-kind="filters"
      data-testid="filters-panel"
      onKeyDown={sheet ? (e) => trapTab(e, ref.current) : undefined}
    >
      {sheet && (
        <div className="eb-sheet-head">
          <span className="eb-mono" role="status" data-testid="filters-head">{head}</span>
          <button type="button" className="eb-sheet-close" aria-label={FILTERS_UI.close} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      )}
      <div className="eb-drop-body">
        {!sheet && <p className="eb-mono eb-fpanel-head" role="status" data-testid="filters-head">{head}</p>}
        {has('time') && section('time')}
        {sheet ? lower.map(section) : lower.length > 0 && <div className="eb-fpanel-row">{lower.map(section)}</div>}
      </div>
      {sheet && (
        <div className="eb-fpanel-foot">
          <button type="button" className="eb-btn" data-testid="filters-show" onClick={onClose}>{showLabel(shown)}</button>
        </div>
      )}
    </div>
  )
  // The sheet goes to <body>: the bar is a size container, which would otherwise be the fixed sheet's containing block.
  return sheet
    ? createPortal(<div className="eb-sheet-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>{body}</div>, document.body)
    : body
}

type UiArgs = {
  state: AppState
  dispatch: (a: Action) => void
  species: SpeciesIndex
  regions: Regions
  hide?: readonly FilterSection[]
  placesNote?: PlacesNote
  time: PanelProps['time']
  threatLine?: number
  shown: number
}

/**
 * The button, the chip row and the panel, wired together as CollageView uses them: `button(inert)` for the dock's
 * `filters` slot, `below` for ControlsBar's, `dimmed` for the content after the dock wrap.
 */
export function useFiltersUi({ state, dispatch, species, regions, hide, placesNote, time, threatLine, shown }: UiArgs): {
  button: (inert: boolean) => ReactNode
  below: ReactNode
  dimmed: boolean
} {
  const base = useId()
  const sheet = useIsSheet()
  const [open, setOpen] = useState<FiltersOpen | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const sections = useFilterSections(state, species, hide)
  const { filter } = state
  const chips = useMemo(() => filterChips(filter, regions), [filter, regions])
  const panelId = `${base}-filters`
  const onOpen = useCallback((o: FiltersOpen | null) => {
    if (o) opener.current = null // closing keeps it: focus goes back to the chip that opened the panel
    setOpen(o)
  }, [])
  const returnFocus = useCallback(() => opener.current, [])
  const onEmpty = useCallback(() => buttonRef.current?.focus(), [])
  // Every removal changes the filter, so the chips change and ChipRow's remembered index is used up.
  const onRemove = useCallback(
    (c: (typeof chips)[number]) => dispatch({ type: 'filter', filter: withoutFilterChip(filter, c) }),
    [dispatch, filter],
  )
  const onChip = useCallback((c: (typeof chips)[number], el: HTMLElement) => {
    opener.current = el
    setOpen({ at: c.kind === 'place' ? 'places' : 'status' })
  }, [])
  const shared = { state, regions, sections, open, onOpen }
  const live = !!open && sections.length > 0
  return {
    button: (inert) => <FiltersButton {...shared} inert={inert} buttonRef={buttonRef} panelId={panelId} />,
    below: (
      <>
        <ChipRow chips={chips} label={FILTERS_UI.chips} testId="filter-chips" onRemove={onRemove} onOpen={onChip} onEmpty={onEmpty} />
        {live && (
          <FiltersPanel
            {...shared}
            dispatch={dispatch}
            species={species}
            id={panelId}
            buttonRef={buttonRef}
            returnFocus={returnFocus}
            placesNote={placesNote}
            time={time}
            threatLine={threatLine}
            shown={shown}
          />
        )}
      </>
    ),
    dimmed: live && !sheet,
  }
}
