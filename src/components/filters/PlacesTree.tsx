'use client'
// The Places panel, design b (`?v=places:b`): one checklist whose rows expand inline. "Countries · N" heads it always;
// a row with places under it ends in a disclosure button (the site's chevron, pointing right when closed and down when
// open) that shows its children as a nested list under the row, indented so a child's checkbox lines up under its
// parent's name. There is no breadcrumb and no "All of" row: the parent row is its own "all", and it is never drawn
// checked or mixed for a checked place under it; instead every ancestor of a checked place starts open, so the checked
// row is in view. Several groups may be open; they close with the panel. A toggle keeps focus on its button. The
// search ("Find a country") matches country rows only; an open group under a matching country stays shown.
import { useId, useMemo, useState } from 'react'
import { ChevronDownIcon } from '@/components/collage/icons'
import { filterPlaceKeys, hasPlaces, togglePlace, withPlaces, type PlaceOption } from '@/lib/list/filters'
import { parentKey, parsePlaceKey } from '@/lib/list/place-keys'
import { fmt, LEVEL_HEAD, matchRows, NO_MATCH, PlaceCheck, PlacesFind, SEARCH_FROM, usePlaceRows, type PlacesBodyProps } from './places-shared'

// `spacer`: some country can open, so every row without a button keeps its room and all counts line up, at every depth.
type TreeProps = PlacesBodyProps & { checked: Set<string>; open: Set<string>; onOpen: (key: string) => void; spacer: boolean }

export function PlacesTree(props: PlacesBodyProps) {
  const { state, species, regions, onFilter } = props
  const { filter } = state
  const [q, setQ] = useState('')
  // Every ancestor of a checked place, open from the start (the panel mounts afresh each time it opens).
  const [open, setOpen] = useState<Set<string>>(() => {
    const out = new Set<string>()
    for (const key of filterPlaceKeys(filter)) for (let k = parentKey(key); k; k = parentKey(k)) out.add(k)
    return out
  })
  const toggleOpen = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const checked = useMemo(() => new Set(filterPlaceKeys(filter)), [filter])
  const rows = usePlaceRows(state, undefined, regions, species)
  const visible = rows.length > SEARCH_FROM ? matchRows(rows, q) : rows
  const tree = { ...props, checked, open, onOpen: toggleOpen, spacer: rows.some((r) => r.children > 0) }

  return (
    <>
      <div className="eb-places-head">
        <span className="eb-mono">{LEVEL_HEAD.country} · {fmt(rows.length)}</span>
        {hasPlaces(filter) && (
          <button type="button" className="eb-textbtn" data-testid="places-clear" onClick={() => onFilter(withPlaces(filter, []))}>Clear</button>
        )}
      </div>
      {rows.length > SEARCH_FROM && <PlacesFind level="country" q={q} onQ={setQ} />}
      {rows.length === 0 ? (
        <p className="eb-note">No places on this list.</p>
      ) : (
        <ul className="eb-checklist eb-places-tree" aria-label={LEVEL_HEAD.country}>
          <TreeRows {...tree} rows={visible} />
          {visible.length === 0 && <li className="eb-note eb-check-none">{NO_MATCH.country}</li>}
        </ul>
      )}
    </>
  )
}

/** The rows of one level, each followed by its open group; flags on country rows only. */
function TreeRows({ rows, ...tree }: TreeProps & { rows: PlaceOption[] }) {
  const flag = rows.length > 0 && parsePlaceKey(rows[0].value)?.level === 'country'
  return rows.map((r) => <TreeRow key={r.value} {...tree} option={r} flag={flag} />)
}

function TreeRow({ option, flag, ...tree }: TreeProps & { option: PlaceOption; flag: boolean }) {
  const { checked, open, onOpen, onFilter, spacer } = tree
  const { filter } = tree.state
  const id = useId()
  const key = option.value
  const own = parsePlaceKey(key)?.level
  // A country's provinces and a province's counties can open; counties have nothing under them.
  const canOpen = option.children > 0 && own !== 'county'
  const isOpen = canOpen && open.has(key)
  const label = own === 'country' ? `States and provinces in ${option.label}` : `Counties in ${option.label}`
  return (
    <li>
      <div className="eb-places-row">
        <PlaceCheck option={option} checked={checked.has(key)} onToggle={() => onFilter(togglePlace(filter, key))} flag={flag} />
        {canOpen ? (
          <button
            type="button"
            className="eb-drill"
            aria-label={label}
            aria-expanded={isOpen}
            aria-controls={isOpen ? id : undefined}
            data-testid={`drill-${key}`}
            onClick={() => onOpen(key)}
          >
            <ChevronDownIcon />
          </button>
        ) : spacer ? <span className="eb-drill-space" aria-hidden="true" /> : null}
      </div>
      {isOpen && <TreeGroup {...tree} parent={key} id={id} label={label} />}
    </li>
  )
}

/** An open row's children, as a nested list; only open groups compute their rows. */
function TreeGroup({ parent, id, label, ...tree }: TreeProps & { parent: string; id: string; label: string }) {
  const rows = usePlaceRows(tree.state, parent, tree.regions, tree.species)
  return (
    <ul id={id} className="eb-places-sub" aria-label={label}>
      {rows.length === 0 ? <li className="eb-note eb-check-none">No places here under the other filters.</li> : <TreeRows {...tree} rows={rows} />}
    </ul>
  )
}
