'use client'
import type { ReactNode } from 'react'
import { fmt, plural } from '@/i18n/core'
import { formatInt } from '@/i18n/format'
import { useI18n } from '@/i18n/I18nProvider'
import './filters.css'

type Props = {
  label: ReactNode
  count?: number
  selected?: boolean
  /** The label is a scientific name (italic, lang="la"). */
  latin?: boolean
  /** A removable chip (an active filter from another tab): its name is "Remove <label> filter". */
  removeLabel?: string
  onClick: () => void
  testId?: string
  /** Trailing content (the remove cross). */
  children?: ReactNode
}

/** LifeList's chip: an 8px squircle, Fill background, Border hairline, Accent border when chosen; the count in Muted. */
export function Chip({ label, count, selected, latin, removeLabel, onClick, testId, children }: Props) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      className="eb-chip"
      data-selected={selected ? '' : undefined}
      aria-pressed={removeLabel ? undefined : !!selected}
      aria-label={removeLabel ? fmt(t.filters.remove, { label: removeLabel }) : undefined}
      lang={latin ? 'la' : undefined}
      data-testid={testId}
      onClick={onClick}
    >
      {label}
      {count != null && (
        <>
          <span className="eb-count" aria-hidden="true">{formatInt(count, t.num)}</span>
          <span className="eb-sr">, {plural(t.collage.stats.species, count, { n: formatInt(count, t.num) })}</span>
        </>
      )}
      {children}
    </button>
  )
}
