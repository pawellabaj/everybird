'use client'
import { FileCsv } from '@phosphor-icons/react'
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import type { EbirdJob } from '@/components/app/use-import-jobs'
import { MYEBIRDDATA_PLACES, PLACES_EVERY, PLACES_FIRST_ONLY } from '@/lib/list/filter-summary'
import { countParts, type SourceCounts } from '@/lib/list/source-counts'
import type { Saved, EbirdDetails } from '@/lib/list/storage'
import { notCounted } from './NotCounted'
import { ebirdLine, HowTo, SourceRow } from './SourceLine'

/** An eBird file already on the list: its slot ('ebird' full export, 'ebird-list' life list) and what is known of it. */
export type EbirdConnected = { slot: 'ebird' | 'ebird-list'; details?: EbirdDetails }

type Props = {
  job: EbirdJob
  /** Reads the file (use-import-jobs.ts: kind detected from the header, parsed in a worker, imported into its slot). */
  onFile: (file: File) => void
  disabled?: boolean
  /** Species already imported from each eBird file (the full MyEBirdData export and the quick life list download). */
  loaded: { full: number; quick: number }
  /** The Places panel's lifer-only note (placesNoteFor): 'reimport' adds the same import-again line here. */
  placesNote?: 'add' | 'reimport'
  /** The eBird files on the list, each with Replace and, in its ⋯ menu, Remove. */
  connected?: EbirdConnected[]
  onRemove?: (slot: EbirdConnected['slot']) => void
  /** For each row's skipped entries. */
  saved?: Saved
  /** Each row's species and "only here" (source-counts.ts). */
  counts?: SourceCounts
}

type Row = {
  slot: EbirdConnected['slot']
  kind: EbirdDetails['kind']
  title: string
  what: string
  /** The Add panel's guidance: what this file is and what it brings. */
  guide: string
  help: ReactNode
}

const ROWS: Row[] = [
  {
    slot: 'ebird-list',
    kind: 'life-list',
    title: 'eBird life list',
    what: 'your eBird life list download',
    guide: 'Your World life list from eBird. It downloads at once, and places each bird to the state or province.',
    help: <p>On eBird: My eBird, then your World life list total, then Download. It&apos;s instant, and places go down to the state or province.</p>,
  },
  {
    slot: 'ebird',
    kind: 'full-export',
    title: 'MyEBirdData',
    what: 'your eBird full export',
    guide: 'eBird’s full export of every checklist. It places birds down to the region (county), and joins your life list if you add both.',
    help: <p>On eBird: Download My Data (under My eBird). eBird emails you MyEBirdData.csv; it places birds down to the region (county).</p>,
  },
]

/**
 * The two eBird files, one quiet row each (Settings > Your list). Not added: "Add" opens the row's panel (what the file
 * brings, the drop zone with "Choose your eBird file", and "How do I get this file?"). Added: the file's name, its species
 * and "only here" (source-counts.ts), skipped entries and date, with Replace (the same picker) and a ⋯ menu (Replace, Remove). Every picker and drop reads
 * the file the same way, and it lands in the row of its kind (read from its header); both rows and the open panels
 * take a dropped file (they highlight while one is dragged over). The import itself runs above the routes, so it
 * survives navigation. With only the life list download, a note under the rows says Places knows only each bird's first
 * place, its "Add MyEBirdData" an inline link (each row keeps its one button); that link and arrival at
 * /settings#add-mydata (the Places panel's note) open MyEBirdData's Add panel and focus its picker (MyEBirdData already
 * on the list: its Replace).
 */
export function EbirdDrop({ job, onFile, disabled, loaded, placesNote, connected = [], onRemove, saved, counts }: Props) {
  const id = useId()
  const [over, setOver] = useState(false)
  const [adding, setAdding] = useState<EbirdConnected['slot'] | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const chooseFull = useRef<HTMLButtonElement>(null)
  const replaceFull = useRef<HTMLButtonElement>(null)
  // Set to focus MyEBirdData's picker once its panel is shown (it is `hidden` until this render commits); `scroll`
  // centres it first (arrival at #add-mydata, from another page).
  const [toPicker, setToPicker] = useState<{ scroll: boolean } | null>(null)
  const { busy, rows, error } = job
  // A file landed (a row connected or went): fold the Add panels away.
  const on = connected.map((c) => c.slot).join()
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

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    if (!disabled) read(e.dataTransfer?.files?.[0])
  }
  const off = disabled || busy
  const pick = () => input.current?.click()
  // Only the life list download: the full export would add every place, down to the county. A MyEBirdData import saved
  // before seen-here should be imported again: the same case, and words, as the Places panel's note.
  const quickOnly = !!loaded.quick && !loaded.full
  const reimport = placesNote === 'reimport'
  const fullOn = connected.some((c) => c.slot === 'ebird')
  const P = MYEBIRDDATA_PLACES
  // An arrival at #add-mydata while a file is being read (the buttons are disabled): taken up once the read is done.
  const pendingFull = useRef<boolean | null>(null)

  // MyEBirdData's Add panel, opened and its picker focused; with MyEBirdData on the list, its Replace focused.
  const toFull = (scroll: boolean) => {
    if (off) {
      pendingFull.current = scroll
      return
    }
    if (fullOn) replaceFull.current?.focus()
    else {
      setAdding('ebird')
      setToPicker({ scroll })
    }
  }
  useEffect(() => {
    if (!toPicker) return
    if (toPicker.scroll) chooseFull.current?.scrollIntoView?.({ block: 'center' })
    chooseFull.current?.focus()
  }, [toPicker])
  const toFullRef = useRef(toFull)
  useEffect(() => { toFullRef.current = toFull })
  useEffect(() => {
    if (off || pendingFull.current === null) return
    const scroll = pendingFull.current
    pendingFull.current = null
    // Not if the birder has since gone elsewhere on the page (#match, #tick). use-import-jobs lands the file and goes
    // idle in one batch, so the rows have already folded their panels when this runs.
    if (window.location.hash === `#${MYEBIRDDATA_PLACES.anchor}`) toFullRef.current(scroll)
  }, [off])
  useEffect(() => {
    const onHash = () => { if (window.location.hash === `#${MYEBIRDDATA_PLACES.anchor}`) toFullRef.current(true) }
    // The Places panel's link is a client navigation: the router writes the new URL after this mounts, and a router
    // push fires no hashchange. Read it once mounted, as MatchReport reads #match.
    onHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div
      className="eb-filedrop"
      data-testid="ebird-drop"
      data-over={over || undefined}
      data-busy={busy || undefined}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false) }}
      onDrop={onDrop}
    >
      <input
        ref={input}
        className="eb-sr"
        type="file"
        accept=".csv,text/csv"
        aria-label="eBird file"
        data-testid="ebird-input"
        tabIndex={-1}
        disabled={off}
        onChange={(e) => read(e.target.files?.[0])}
      />
      {ROWS.map((r) => {
        const c = connected.find((x) => x.slot === r.slot)
        const line = c ? ebirdLine(r.kind, c.details) : null
        const open = adding === r.slot
        return (
          <SourceRow
            key={r.slot}
            testId={c ? `source-${r.slot}` : undefined}
            title={r.title}
            name={line?.name}
            parts={line ? line.parts : ['Not added']}
            counts={c && counts ? countParts(counts.rows[r.slot]) : undefined}
            skipped={c && saved ? notCounted(saved, [r.slot]) ?? undefined : undefined}
            what={c ? r.what : undefined}
            disabled={off}
            onRemove={() => onRemove?.(r.slot)}
            menu={c ? [{ label: 'Replace', onSelect: pick }] : undefined}
            primary={
              c ? (
                <button ref={r.slot === 'ebird' ? replaceFull : undefined} type="button" className="eb-btn eb-btn-quiet eb-btn-sm" disabled={off} onClick={pick} aria-label={`Replace ${line!.name}`}>
                  Replace
                </button>
              ) : (
                <button
                  type="button"
                  className="eb-btn eb-btn-quiet eb-btn-sm"
                  disabled={off}
                  aria-expanded={open}
                  aria-controls={`${id}-${r.slot}`}
                  aria-label={`Add ${r.title}`}
                  onClick={() => setAdding(open ? null : r.slot)}
                >
                  Add
                </button>
              )
            }
          >
            {!c && (
              <div id={`${id}-${r.slot}`} className="eb-src-panel" hidden={!open} role="group" aria-label={`Add ${r.title}`}>
                <p className="eb-note">{r.guide}</p>
                <div className="eb-dropzone">
                  <button ref={r.slot === 'ebird' ? chooseFull : undefined} type="button" className="eb-btn" disabled={off} onClick={pick}>
                    <FileCsv aria-hidden="true" focusable="false" />
                    Choose your eBird file
                  </button>
                  <span className="eb-note eb-drop-hint">or drop it here</span>
                </div>
                <HowTo label="How do I get this file?">{r.help}</HowTo>
              </div>
            )}
          </SourceRow>
        )
      })}
      {quickOnly && (
        <p className="eb-note eb-src-status eb-lifer-note" data-testid="places-lifer-note">
          Your eBird life list only says where you first recorded each bird, so Places filters by those first places.{' '}
          <a
            href={`#${P.anchor}`}
            data-testid="places-lifer-add"
            aria-label={`${P.add} for every place`}
            aria-controls={fullOn ? undefined : `${id}-ebird`}
            onClick={(e) => {
              e.preventDefault()
              // During a read the request is held until it ends, and taken up only while the address names it.
              if (off) history.replaceState(history.state, '', `#${P.anchor}`)
              toFull(false)
            }}
          >
            {P.add}
          </a>
          {' '}to filter by {PLACES_EVERY}, {P.reach}.
        </p>
      )}
      <p className="eb-status eb-src-status" role="status">
        {busy ? (rows ? `Reading your file… ${rows.toLocaleString('en-US')} rows` : 'Reading your file…') : ''}
      </p>
      {error && <p className="eb-error eb-src-status" role="alert">{error}</p>}
      {reimport && (
        <p className="eb-note eb-src-status" data-testid="ebird-detail">
          {PLACES_FIRST_ONLY} {P.again} to filter by {PLACES_EVERY}.
        </p>
      )}
    </div>
  )
}
