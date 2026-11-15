import type { Regions } from '@/lib/species/types'
import type { ParseKind, ParseResponse, ParseResult } from './parse.worker'

/** Parse a supported export in a module worker; resolves with the ImportResult, reports row progress. */
export function parseInWorker(
  kind: ParseKind, file: File, onProgress?: (rows: number) => void,
  synonyms?: Record<string, string>, regions?: Regions,
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })
    const done = () => worker.terminate()
    worker.onmessage = (e: MessageEvent<ParseResponse>) => {
      const m = e.data
      if (m.type === 'progress') onProgress?.(m.rows)
      else if (m.type === 'done') {
        done()
        resolve(m.result)
      } else {
        done()
        reject(new Error(m.message))
      }
    }
    worker.onerror = (e) => {
      done()
      reject(new Error(e.message || 'Import worker failed'))
    }
    worker.postMessage({ kind, file, synonyms, regions })
  })
}
