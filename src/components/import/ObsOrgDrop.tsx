'use client'
import { useId, useRef, useState } from 'react'
import type { FileJob } from '@/components/app/use-import-jobs'
import { OBSORG_PLACES } from '@/lib/list/filter-summary'
import { countParts, type SourceCounts } from '@/lib/list/source-counts'
import type { ObsOrgDetails, Saved } from '@/lib/list/storage'
import { FileDropzone, useFileDrop } from './FileDropzone'
import { notCounted } from './NotCounted'
import { OBSORG_CHOOSE, OBSORG_HOWTO, OBSORG_INPUT, OBSORG_NOTE, OBSORG_ROWS } from './obsorg-copy'
import { HowTo, obsorgLine, SourceRow } from './SourceLine'
import { useAnchorTarget } from './use-anchor-target'

/** An observation.org file already on the list: its slot ('obsorg-list' Observed species, 'obsorg' the observations). */
export type ObsOrgConnected = { slot: 'obsorg' | 'obsorg-list'; details?: ObsOrgDetails }

type Props = {
  job: FileJob
  /** Reads the file (use-import-jobs.ts: kind detected from the header, parsed in a worker, imported into its slot). */
  onFile: (file: File) => void
  disabled?: boolean
  /** The observation.org files on the list, each with Replace and, in its ⋯ menu, Remove. */
  connected?: ObsOrgConnected[]
  onRemove?: (slot: ObsOrgConnected['slot']) => void
  /** For each row's skipped entries. */
  saved?: Saved
  /** Each row's species and "only here" (source-counts.ts). */
  counts?: SourceCounts
  /** When the last import landed (use-import-jobs `landed.at`), from any source: the open Add panels fold. */
  landedAt?: number
}

type Row = { slot: ObsOrgConnected['slot']; kind: ObsOrgDetails['kind'] }

const ROWS: Row[] = [
  { slot: 'obsorg-list', kind: 'species-list' },
  { slot: 'obsorg', kind: 'observations' },
]

/**
 * observation.org's two exports, one quiet row each (Settings > Your list), built as EbirdDrop's rows: the life list
 * (Observed species: first dates, no places), then the observations (every bird observation, placed by country and
 * province). Not added: "Add" opens the row's panel (what the file brings, the drop zone, "How do I get this file?").
 * Added: the file's name, its species and "only here", skipped entries and date, with Replace and a ⋯ menu (Replace,
 * Remove). Any picker or drop reads any supported file, and it lands in the row of its kind. With only the life list,
 * a note under the rows says Places can't filter those birds; its inline link and arrival at /settings#add-obsorg
 * (the Places panel's line) open the observations' Add panel and focus its picker (observations on the list: its
 * Replace).
 */
export function ObsOrgDrop({ job, onFile, disabled, connected = [], onRemove, saved, counts, landedAt }: Props) {
  const id = useId()
  const [adding, setAdding] = useState<ObsOrgConnected['slot'] | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const chooseObs = useRef<HTMLButtonElement>(null)
  const replaceObs = useRef<HTMLButtonElement>(null)
  const { busy, rows, error } = job
  // A file landed anywhere (in this group or the other, new or a replacement: `landedAt`), or a row went: fold the
  // Add panels away.
  const on = `${connected.map((c) => c.slot).join()}|${landedAt ?? ''}`
  const [lastOn, setLastOn] = useState(on)
  if (lastOn !== on) {
    setLastOn(on)
    setAdding(null)
  }

  const read = (file: File | undefined) => {
    if (!file || busy) return
    onFile(file)
    if (input.current) input.current.value = ''
  }
  const { over, handlers } = useFileDrop(read, disabled)
  const off = disabled || busy
  const pick = () => input.current?.click()
  const listOn = connected.some((c) => c.slot === 'obsorg-list')
  const obsOn = connected.some((c) => c.slot === 'obsorg')
  const P = OBSORG_PLACES
  // The observations' Add panel, opened and its picker focused; with the observations on the list, their Replace.
  const toObs = useAnchorTarget({ anchor: P.anchor, off, connected: obsOn, open: () => setAdding('obsorg'), picker: chooseObs, replace: replaceObs })

  return (
    <div className="eb-filedrop" data-testid="obsorg-drop" data-over={over || undefined} data-busy={busy || undefined} {...handlers}>
      <input
        ref={input}
        className="eb-sr"
        type="file"
        accept=".csv,text/csv"
        aria-label={OBSORG_INPUT}
        data-testid="obsorg-input"
        tabIndex={-1}
        disabled={off}
        onChange={(e) => read(e.target.files?.[0])}
      />
      {ROWS.map((r) => {
        const copy = OBSORG_ROWS[r.slot]
        const c = connected.find((x) => x.slot === r.slot)
        const line = c ? obsorgLine(r.kind, c.details) : null
        const open = adding === r.slot
        return (
          <SourceRow
            key={r.slot}
            testId={c ? `source-${r.slot}` : undefined}
            title={copy.title}
            name={line?.name}
            parts={line ? line.parts : ['Not added']}
            counts={c && counts ? countParts(counts.rows[r.slot]) : undefined}
            skipped={c && saved ? notCounted(saved, [r.slot]) ?? undefined : undefined}
            what={c ? copy.what : undefined}
            disabled={off}
            onRemove={() => onRemove?.(r.slot)}
            menu={c ? [{ label: 'Replace', onSelect: pick }] : undefined}
            primary={
              c ? (
                <button ref={r.slot === 'obsorg' ? replaceObs : undefined} type="button" className="eb-btn eb-btn-quiet eb-btn-sm" disabled={off} onClick={pick} aria-label={`Replace ${line!.name}`}>
                  Replace
                </button>
              ) : (
                <button
                  type="button"
                  className="eb-btn eb-btn-quiet eb-btn-sm"
                  disabled={off}
                  aria-expanded={open}
                  aria-controls={`${id}-${r.slot}`}
                  aria-label={`Add ${copy.title}`}
                  onClick={() => setAdding(open ? null : r.slot)}
                >
                  Add
                </button>
              )
            }
          >
            {!c && (
              <div id={`${id}-${r.slot}`} className="eb-src-panel" hidden={!open} role="group" aria-label={`Add ${copy.title}`}>
                <p className="eb-note">{copy.guide}</p>
                <FileDropzone label={OBSORG_CHOOSE} disabled={off} onPick={pick} buttonRef={r.slot === 'obsorg' ? chooseObs : undefined} />
                <HowTo label={OBSORG_HOWTO}><p>{copy.help}</p></HowTo>
              </div>
            )}
          </SourceRow>
        )
      })}
      {listOn && !obsOn && (
        <p className="eb-note eb-src-status eb-lifer-note" data-testid="places-obsorg-note">
          {OBSORG_NOTE.lead}{' '}
          <a
            href={`#${P.anchor}`}
            data-testid="places-obsorg-add"
            aria-controls={`${id}-obsorg`}
            onClick={(e) => {
              e.preventDefault()
              // During a read the request is held until it ends, and taken up only while the address names it.
              if (off) history.replaceState(history.state, '', `#${P.anchor}`)
              toObs(false)
            }}
          >
            {P.add}
          </a>
          {OBSORG_NOTE.tail}
        </p>
      )}
      <p className="eb-status eb-src-status" role="status">
        {busy ? (rows ? `Reading your file… ${rows.toLocaleString('en-US')} rows` : 'Reading your file…') : ''}
      </p>
      {error && <p className="eb-error eb-src-status" role="alert">{error}</p>}
    </div>
  )
}
