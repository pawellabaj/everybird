'use client'
// The imports in flight (an eBird or observation.org file being read, an iNaturalist fetch), kept in the provider above the routes, so
// they keep running and keep their progress while the birder moves between /, /settings and /about.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OBSORG_ERRORS } from '@/components/import/obsorg-copy'
import { detectFile, slotOfKind, type FileKind } from '@/lib/import/detect'
import { importInat, type InatError, type InatProgress } from '@/lib/import/inat'
import { parseErrorCode, parseInWorker } from '@/lib/import/parse-client'
import type { ParseResult } from '@/lib/import/parse.worker'
import { loadRegions } from '@/lib/import/places'
import type { ImportResult, Slot } from '@/lib/list/model'
import type { DetailsFor, EbirdDetails, ObsOrgDetails } from '@/lib/list/storage'
import { loadTaxonomy } from '@/lib/species/load'
import { fetchData } from '@/lib/data-url'

/** A file being read (an eBird or observation.org export), shown under the row group it was given to. */
export type FileJob = { busy: boolean; rows: number; error: string | null }
export type EbirdJob = FileJob
export type InatJob = { busyFor: string | null; progress: InatProgress | null; error: string | null; note: string | null }
/** The last import that landed (what "See my collage" announces). */
export type Landed = { slot: Slot; species: number; at: number }

export type ImportJobs = {
  ebird: FileJob
  /** Detects the file's kind from its header, parses it in a worker and imports it into its slot; status and errors
   *  show on the eBird rows. */
  readEbird: (file: File) => Promise<void>
  obsorg: FileJob
  /** The same read, its status and errors on the observation.org rows. Any supported file lands in its kind's slot. */
  readObsOrg: (file: File) => Promise<void>
  inat: InatJob
  /** Fetches (or, with the remembered username, refreshes) an iNaturalist account into the 'inat' slot. */
  fetchInat: (login: string) => Promise<void>
  cancelInat: () => void
  landed: Landed | null
}

const HEAD_BYTES = 64 * 1024

/** The header line of a file (only the first 64 KB are read here; the worker reads the rest). */
async function headerLine(file: File): Promise<string> {
  const blob = file.slice(0, HEAD_BYTES)
  const text = typeof blob.text === 'function'
    ? await blob.text()
    : await new Promise<string>((done, fail) => {
        const r = new FileReader()
        r.onload = () => done(String(r.result))
        r.onerror = () => fail(r.error)
        r.readAsText(blob)
      })
  return text.split(/\r?\n/, 1)[0] ?? ''
}

let synonymsP: Promise<Record<string, string>> | null = null
function loadSynonyms(): Promise<Record<string, string>> {
  synonymsP ??= fetchData<Record<string, string>>('inat-synonyms.v1.json')
    .catch((e) => {
      synonymsP = null
      throw e
    })
  return synonymsP
}

/** Plain messages; the rest of the list is untouched whenever one shows. */
export function inatMessage(error: InatError, user: string): string {
  switch (error) {
    case 'unknown-user':
      return `We couldn't find an iNaturalist user called “${user}”. Check the username (not the display name).`
    case 'no-birds':
      return `“${user}” has no public bird observations on iNaturalist yet.`
    case 'network':
      return "Couldn't reach iNaturalist. Check your connection and try again."
    case 'rate-limited':
      return 'iNaturalist is busy right now. Wait a minute, then try again.'
  }
}

const IDLE_FILE: FileJob = { busy: false, rows: 0, error: null }
const EBIRD_UNKNOWN = "Couldn't read this file. Use eBird's life list download or MyEBirdData.csv."
const EBIRD_DAMAGED = "Couldn't read this file. It may be damaged or not an eBird export."
/** The row group a file was given to. */
type Via = 'ebird' | 'obsorg'
const IDLE_INAT: InatJob = { busyFor: null, progress: null, error: null, note: null }

export type OnImport = (slot: Slot, result: ImportResult, details: DetailsFor<Slot>) => void

/**
 * `onImport` receives each finished import with its slot and the source's details (storage.ts `SourceDetails`: the
 * file's name, kind and rows, or the username and observation count; both with the time): the full MyEBirdData export
 * goes to 'ebird', the quick life list download to 'ebird-list', observation.org's Observed species to 'obsorg-list'
 * and its observations to 'obsorg', so one never replaces another. The file's kind (its header) picks the slot, not
 * the rows it was given to. Unmounting (leaving
 * the app's pages) aborts.
 */
export function useImportJobs(onImport: OnImport): ImportJobs {
  const [ebird, setEbird] = useState<FileJob>(IDLE_FILE)
  const [obsorg, setObsorg] = useState<FileJob>(IDLE_FILE)
  const [inat, setInat] = useState<InatJob>(IDLE_INAT)
  const [landed, setLanded] = useState<Landed | null>(null)
  const abort = useRef<AbortController | null>(null)
  const busyFile = useRef(false)
  const live = useRef(true)
  const latest = useRef(onImport)
  useEffect(() => { latest.current = onImport })
  useEffect(() => {
    live.current = true
    return () => { live.current = false; abort.current?.abort() }
  }, [])

  const land = useCallback((slot: Slot, result: ImportResult, details: DetailsFor<Slot>) => {
    latest.current(slot, result, details)
    setLanded({ slot, species: new Set(result.records.map((r) => r.code)).size, at: Date.now() })
  }, [])

  // One file at a time, across both file groups (the eBird rows and the observation.org rows).
  const readFile = useCallback(async (file: File, via: Via) => {
    if (busyFile.current) return
    busyFile.current = true
    const set = via === 'ebird' ? setEbird : setObsorg
    setEbird(IDLE_FILE)
    setObsorg(IDLE_FILE)
    let kind: FileKind = 'unknown'
    try {
      try {
        kind = detectFile(await headerLine(file), file.name)
      } catch {
        kind = 'unknown'
      }
      const slot = slotOfKind(kind)
      if (kind === 'xlsx' || kind === 'unknown' || !slot) {
        set({ ...IDLE_FILE, error: kind === 'xlsx' ? OBSORG_ERRORS.xlsx : via === 'ebird' ? EBIRD_UNKNOWN : OBSORG_ERRORS.unknown })
        return
      }
      set({ busy: true, rows: 0, error: null })
      const onProgress = (rows: number) => { if (live.current) set((j) => ({ ...j, rows })) }
      try {
        const at = new Date().toISOString()
        let result: ParseResult
        let details: EbirdDetails | ObsOrgDetails
        if (kind === 'ebird-lifelist' || kind === 'ebird-mydata') {
          result = await parseInWorker(kind, file, { onProgress })
          details = { kind: kind === 'ebird-lifelist' ? 'life-list' : 'full-export', at } satisfies EbirdDetails
        } else if (kind === 'obsorg-species') {
          result = await parseInWorker(kind, file, { onProgress, synonyms: await loadSynonyms() })
          details = { kind: 'species-list', at } satisfies ObsOrgDetails
        } else {
          const [synonyms, regions] = await Promise.all([loadSynonyms(), loadRegions()])
          result = await parseInWorker(kind, file, { onProgress, synonyms, regions })
          details = { kind: 'observations', at, ...(result.excluded ? { excluded: result.excluded } : {}) } satisfies ObsOrgDetails
        }
        if (file.name) details.file = file.name
        if (typeof result.rows === 'number') details.rows = result.rows
        if (live.current) land(slot, result, details)
        set(IDLE_FILE)
      } catch (e) {
        // observation.org's words for its own files (given to either group) and for any file given to its rows.
        const obsorg = kind === 'obsorg-species' || kind === 'obsorg-observations' || via === 'obsorg'
        const code = parseErrorCode(e)
        set({ ...IDLE_FILE, error: code === 'no-birds' ? OBSORG_ERRORS.noBirds : obsorg ? OBSORG_ERRORS.damaged : EBIRD_DAMAGED })
      }
    } finally {
      busyFile.current = false
    }
  }, [land])
  const readEbird = useCallback((file: File) => readFile(file, 'ebird'), [readFile])
  const readObsOrg = useCallback((file: File) => readFile(file, 'obsorg'), [readFile])

  const fetchInat = useCallback(async (raw: string) => {
    const login = raw.trim().replace(/^@/, '').trim() // "@ sam" too: the username is stored and shown exactly
    if (!login || abort.current) return
    setInat({ busyFor: login, progress: null, error: null, note: null })
    const ctl = new AbortController()
    abort.current = ctl
    let end: Partial<InatJob> = {}
    let observations = 0
    try {
      const [taxonomy, synonyms, regions] = await Promise.all([loadTaxonomy(), loadSynonyms(), loadRegions()])
      const res = await importInat(login, {
        taxonomy, synonyms, regions, signal: ctl.signal,
        onProgress: (progress) => {
          observations = progress.fetched
          if (abort.current === ctl) setInat((j) => ({ ...j, progress }))
        },
      })
      if (ctl.signal.aborted) end = { note: 'Cancelled. Nothing was changed.' }
      else if ('error' in res) end = { error: inatMessage(res.error, login) }
      else land('inat', res, { user: login, observations, at: new Date().toISOString() })
    } catch (err) {
      end = (err as Error)?.name === 'AbortError' || ctl.signal.aborted ? { note: 'Cancelled. Nothing was changed.' } : { error: inatMessage('network', login) }
    } finally {
      if (abort.current === ctl) abort.current = null
      setInat({ ...IDLE_INAT, ...end })
    }
  }, [land])

  const cancelInat = useCallback(() => abort.current?.abort(), [])

  return useMemo(
    () => ({ ebird, readEbird, obsorg, readObsOrg, inat, fetchInat, cancelInat, landed }),
    [ebird, readEbird, obsorg, readObsOrg, inat, fetchInat, cancelInat, landed],
  )
}
