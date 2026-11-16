'use client'
import { useState, type ReactNode } from 'react'
import { FilterLinesIcon } from '@/components/collage/icons'
import { useI18n } from '@/i18n/I18nProvider'
import type { ChipOption, FilterLevel } from '@/lib/list/filters'
import { Chip } from './Chip'
import { PickerSheet } from './PickerSheet'

type Level = FilterLevel

type PickerProps = {
  level: Level
  options: ChipOption[]
  label: (level: Level, o: ChipOption) => ReactNode
  latin: boolean
  chosen?: string
  value?: string
  onPick: (v: string) => void
}

/** Phone: one button; it reads "Choose an order 18" or the chosen group's name, and opens the chips in a sheet. */
export function SheetPicker({ level, options: opts, label, latin, chosen, value, onPick }: PickerProps) {
  const [open, setOpen] = useState(false)
  const { t } = useI18n()
  return (
    <>
      <button
        type="button"
        className="eb-pick"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-selected={chosen ? '' : undefined}
        data-testid={`picker-${level}`}
        onClick={() => setOpen(true)}
      >
        <FilterLinesIcon />
        <span className="eb-pick-label" lang={chosen && latin ? 'la' : undefined}>
          {chosen ?? t.filters.choose[level]}
        </span>{' '}
        <span className="eb-count">{opts.length}</span>
      </button>
      {open && (
        <PickerSheet title={t.filters.rank[level]} count={opts.length} onClose={() => setOpen(false)}>
          <div className="eb-picklist" data-chosen={value ? '' : undefined}>
            {opts.map((o) => (
              <Chip key={o.value} label={label(level, o)} latin={latin} count={o.count} selected={value === o.value} onClick={() => { onPick(o.value); setOpen(false) }} />
            ))}
          </div>
        </PickerSheet>
      )}
    </>
  )
}
