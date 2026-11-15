'use client'
// The Status panel's body (the Status dropdown in FilterDropdowns.tsx), on the Places panel's structure: the head
// "Categories · N" with Clear, a Muted note, then one checklist of global IUCN Red List categories in Red List order,
// each row the box, the pill, the full name and the count (species under the OTHER filters, statusOptions). A checked
// category another filter left with no species stays, at 0, so it can be unchecked. At most eight rows: no search.
import { useMemo } from 'react'
import { IucnPill } from '@/components/collage/IucnPill'
import { statusOptions, toggleStatus, withStatuses, type Filter } from '@/lib/list/filters'
import type { AppState } from '@/lib/list/store'
import { IUCN_CATS, IUCN_NAMES, type IucnCat } from '@/lib/species/iucn'
import type { SpeciesIndex } from '@/lib/species/load'
import { fmt } from './places-shared'

export const STATUS_NOTE = 'Global IUCN Red List categories. Birds without one are left out once you pick a category.'

type Props = {
  state: AppState
  species: SpeciesIndex
  /** The list's threatened count, for the line under the note (the `threat` preview's c); none: no line. */
  threatLine?: number
  onFilter: (f: Filter) => void
}

export function StatusList({ state, species, threatLine, onFilter }: Props) {
  const { list, filter, seen } = state
  const counted = useMemo(() => statusOptions(list, filter, species, seen), [list, filter, species, seen])
  const checked = useMemo(() => new Set<IucnCat>(filter.statuses ?? []), [filter.statuses])
  // The counted rows, and any checked category they lack at 0, all in Red List order.
  const rows = useMemo(() => {
    const by = new Map(counted.map((o) => [o.value, o.count]))
    return IUCN_CATS.filter((c) => by.has(c) || checked.has(c)).map((c) => ({ cat: c, count: by.get(c) ?? 0 }))
  }, [counted, checked])

  return (
    <div className="eb-places eb-status">
      <div className="eb-places-head">
        <span className="eb-mono">Categories · {fmt(rows.length)}</span>
        {checked.size > 0 && (
          <button type="button" className="eb-textbtn" data-testid="status-clear" onClick={() => onFilter(withStatuses(filter, []))}>Clear</button>
        )}
      </div>
      <p className="eb-note eb-places-note">{STATUS_NOTE}</p>
      {threatLine !== undefined && threatLine > 0 && (
        <p className="eb-note eb-places-note" data-testid="status-threatened">
          {fmt(threatLine)} threatened: Vulnerable, Endangered or Critically Endangered.
        </p>
      )}
      <ul className="eb-checklist" aria-label="Categories">
        {rows.map(({ cat, count }) => {
          const on = checked.has(cat)
          return (
            <li key={cat} className="eb-status-row">
              <label className="eb-check" data-checked={on ? '' : undefined}>
                <input type="checkbox" checked={on} onChange={() => onFilter(toggleStatus(filter, cat))} data-testid={`status-${cat}`} />
                <IucnPill cat={cat} />
                <span className="eb-check-name">{IUCN_NAMES[cat]}</span>
                <span className="eb-count" aria-hidden="true">{fmt(count)}</span>
                <span className="eb-sr">, {fmt(count)} species</span>
              </label>
            </li>
          )
        })}
        {rows.length === 0 && <li className="eb-note eb-check-none">No categories here under the other filters.</li>}
      </ul>
    </div>
  )
}
