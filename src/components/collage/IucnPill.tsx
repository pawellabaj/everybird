// A global IUCN Red List category as a small pill in the Red List chart's colours (IUCN_COLORS): the fill and the
// text are fixed and the same in both themes; only the 1px Line ring follows the theme (card-list.css .eb-iucn).
// The pill is decoration beside words that name the category, so it is hidden from assistive tech. The Status panel's
// rows have their own full name beside it; the bird card uses IucnBadge: the pill and the full name as plain text,
// always visible (no press), read as "Vulnerable (IUCN Red List)".
import type { CSSProperties } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { IUCN_COLORS, type IucnCat } from '@/lib/species/iucn'
import './card-list.css'

export function IucnPill({ cat }: { cat: IucnCat }) {
  const style = { '--iucn-fill': IUCN_COLORS[cat].fill, '--iucn-text': IUCN_COLORS[cat].text } as CSSProperties
  return (
    <span className="eb-iucn" data-cat={cat} style={style} aria-hidden="true">
      {cat}
    </span>
  )
}

/** The bird card's status: the pill, then the full name in the card's mono meta style. Never on the tooltip. */
export function IucnBadge({ cat }: { cat: IucnCat }) {
  const { t } = useI18n()
  return (
    <span className="eb-iucn-badge" data-testid="iucn-badge">
      <IucnPill cat={cat} />
      <span className="eb-iucn-name">
        {t.iucn.names[cat]}
        <span className="eb-sr"> {t.iucn.inList}</span>
      </span>
    </span>
  )
}
