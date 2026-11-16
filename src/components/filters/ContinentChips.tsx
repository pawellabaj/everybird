'use client'
// The continent chips at the top of the Places section (above the drill): one toggle chip per continent with species
// under the other filters, its count muted, pressed while it is chosen. A tap filters to every country on the
// continent; a second tap clears it. Multi-select, so they are not the taxonomy's single-choice row (no dimming, no
// accent border on the unchosen).
import { continentRows, toggleContinent, type Filter, type PlaceCounts } from '@/lib/list/filters'
import { Chip } from './Chip'

type Props = { counts: PlaceCounts; filter: Filter; onFilter: (f: Filter) => void }

export function ContinentChips({ counts, filter, onFilter }: Props) {
  const rows = continentRows(counts, filter)
  if (!rows.length) return null
  return (
    <div role="group" aria-label="Continents" className="eb-places-continents" data-testid="places-continents">
      {rows.map((r) => (
        <Chip
          key={r.value}
          label={r.label}
          count={r.count}
          selected={r.checked}
          testId={`continent-${r.value}`}
          onClick={() => onFilter(toggleContinent(filter, r.value))}
        />
      ))}
    </div>
  )
}
