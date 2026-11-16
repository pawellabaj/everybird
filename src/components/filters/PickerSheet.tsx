'use client'
import { useRef, type ReactNode } from 'react'
import { trapTab, useEscapeCapture, useFocusInAndBack, useHoldTopBar } from '@/components/dialog-utils'
import { CloseIcon } from '@/components/collage/icons'
import { formatInt } from '@/i18n/format'
import { useI18n } from '@/i18n/I18nProvider'
import './filters.css'

type Props = { title: string; count: number; onClose: () => void; children: ReactNode }

/** Phone bottom sheet for a level's chips (LifeList's picksheet). Modal: Esc and the scrim close it, Tab stays inside, focus returns to the opener. */
export function PickerSheet({ title, count, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useI18n()
  useEscapeCapture(onClose)
  useFocusInAndBack(ref)
  useHoldTopBar()
  return (
    <div className="eb-sheet-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={ref}
        className="eb-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => trapTab(e, ref.current)}
      >
        <div className="eb-sheet-head">
          <span className="eb-mono">{title} · {formatInt(count, t.num)}</span>
          <button type="button" className="eb-sheet-close" aria-label={t.collage.close} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
