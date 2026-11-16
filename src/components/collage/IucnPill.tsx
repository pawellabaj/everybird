'use client'
// A global IUCN Red List category as a small pill in the Red List chart's colours (IUCN_COLORS): the fill and the
// text are fixed and the same in both themes; only the 1px Line ring follows the theme (card-list.css .eb-iucn).
// The span form is decoration beside words that already name the category (the Status panel's rows), so it is
// hidden from assistive tech. The button form is the bird card's: a toggletip whose label (the full name) shows on a
// press, on keyboard focus and on a fine pointer's hover. The label is visual only: the button's name already says it.
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { IUCN_COLORS, IUCN_NAMES, type IucnCat } from '@/lib/species/iucn'
import './card-list.css'

export function IucnPill({ cat, as = 'span' }: { cat: IucnCat; as?: 'span' | 'button' }) {
  const style = { '--iucn-fill': IUCN_COLORS[cat].fill, '--iucn-text': IUCN_COLORS[cat].text } as CSSProperties
  if (as === 'button') return <IucnToggletip cat={cat} style={style} />
  return (
    <span className="eb-iucn" data-cat={cat} style={style} aria-hidden="true">
      {cat}
    </span>
  )
}

function IucnToggletip({ cat, style }: { cat: IucnCat; style: CSSProperties }) {
  const [open, setOpen] = useState(false)
  const tipId = useId()
  const ref = useRef<HTMLSpanElement>(null)
  // An open tip closes on a press anywhere else or when focus leaves the pill (Esc stays the card's: it closes the card).
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [open])
  return (
    <span ref={ref} className="eb-iucn-wrap" data-open={open || undefined} data-testid="iucn-wrap">
      <button
        type="button"
        className="eb-iucn"
        data-cat={cat}
        style={style}
        aria-label={`${cat}, ${IUCN_NAMES[cat]} (IUCN Red List)`}
        aria-expanded={open}
        aria-controls={tipId}
        data-testid="iucn-pill"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
      >
        {cat}
      </button>
      <span id={tipId} className="eb-iucn-tip" aria-hidden="true">{IUCN_NAMES[cat]}</span>
    </span>
  )
}
