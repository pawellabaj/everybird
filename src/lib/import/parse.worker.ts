import { loadTaxonomy } from '@/lib/species/load'
import type { TaxonomyIndex } from '@/lib/species/resolve'
import type { ImportResult } from '@/lib/list/model'
import { parseEbirdLifeList } from './ebird-lifelist'
import { parseEbirdMyData } from './ebird-mydata'
import { parseObsOrgSpecies, parseObsOrgObservations, type ObsOrgObservationsResult } from './obsorg'
import type { Regions } from '@/lib/species/types'

export type ParseKind = 'ebird-lifelist' | 'ebird-mydata' | 'obsorg-species' | 'obsorg-observations'
/** observation.org's kinds need the iNaturalist synonyms (and the observations the regions); eBird's need neither. */
export type ParseRequest =
  | { kind: 'ebird-lifelist'; file: File }
  | { kind: 'ebird-mydata'; file: File }
  | { kind: 'obsorg-species'; file: File; synonyms: Record<string, string> }
  | { kind: 'obsorg-observations'; file: File; synonyms: Record<string, string>; regions: Regions }
export type ParseResult = ImportResult & { excluded?: ObsOrgObservationsResult['excluded']; undated?: number }
export type ParseResponse =
  | { type: 'progress'; rows: number }
  | { type: 'done'; result: ParseResult }
  | { type: 'error'; message: string }

const PROGRESS_MS = 100
const PROGRESS_ROWS = 5000

/** The worker's whole job, injectable for tests: load the taxonomy, dispatch to the parser, post messages. */
export async function handleParseMessage(
  msg: ParseRequest,
  post: (m: ParseResponse) => void,
  load: () => Promise<TaxonomyIndex> = loadTaxonomy,
): Promise<void> {
  try {
    const t = await load()
    let last = 0
    let lastRows = 0
    const onProgress = (rows: number) => {
      const now = Date.now()
      if (now - last >= PROGRESS_MS || rows - lastRows >= PROGRESS_ROWS) {
        last = now
        lastRows = rows
        post({ type: 'progress', rows })
      }
    }
    let result: ParseResult | { error: 'no-birds' }
    switch (msg.kind) {
      case 'ebird-mydata':
        result = await parseEbirdMyData(msg.file, t, onProgress)
        break
      case 'ebird-lifelist':
        result = parseEbirdLifeList(await msg.file.text(), t)
        break
      case 'obsorg-species':
        if (!msg.synonyms) throw new Error('observation.org synonyms are required.')
        result = parseObsOrgSpecies(await msg.file.text(), t, msg.synonyms)
        break
      case 'obsorg-observations':
        if (!msg.synonyms) throw new Error('observation.org synonyms are required.')
        if (!msg.regions) throw new Error('observation.org regions are required.')
        result = await parseObsOrgObservations(msg.file, t, msg.synonyms, msg.regions, onProgress)
        break
      default:
        throw new Error('Unsupported import kind.')
    }
    if ('error' in result) {
      post({ type: 'error', message: result.error })
      return
    }
    post({ type: 'done', result })
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}

declare const WorkerGlobalScope: unknown
// Only wire up the message listener inside a real worker (not in vitest or the main thread).
if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof (WorkerGlobalScope as never)) {
  const scope = self as unknown as { onmessage: ((e: MessageEvent<ParseRequest>) => void) | null; postMessage: (m: ParseResponse) => void }
  scope.onmessage = (e) => void handleParseMessage(e.data, (m) => scope.postMessage(m))
}
