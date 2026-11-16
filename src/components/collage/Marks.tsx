'use client'
import { useI18n } from '@/i18n/I18nProvider'
import type { Ui } from '@/i18n/messages/en'
import type { ListEntry } from '@/lib/list/model'

/** Everybird's marks: heard only and found dead as on LifeList (their words: `ui.card.heard`, `ui.card.dead`). The
 *  stored `media` field is kept but not shown. */
export const MARKS = [
  { k: 'heard', sym: '*' },
  { k: 'dead', sym: '†' },
] as const

export const marksOf = (e: ListEntry) => MARKS.filter((m) => e[m.k])

/** A mark's words ("Heard only"). */
export const markLabel = (k: (typeof MARKS)[number]['k'], t: Ui): string => t.card[k]

/** The marks as a superscript after a name, with screen-reader text (LifeList's Mark). */
export function Marks({ entry }: { entry: ListEntry }) {
  const { t } = useI18n()
  const ms = marksOf(entry)
  if (!ms.length) return null
  return (
    <>
      <sup className="eb-mark" aria-hidden="true">{ms.map((m) => m.sym).join('')}</sup>
      <span className="eb-sr">, {ms.map((m) => markLabel(m.k, t).toLowerCase()).join(', ')}</span>
    </>
  )
}
