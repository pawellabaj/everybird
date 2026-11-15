import type { ParseKind, ParseRequest, ParseResponse, ParseResult } from './parse.worker'

/** What a kind's parse needs beside the file: observation.org needs the synonyms, its observations the regions too. */
export type ParseOptions<K extends ParseKind> = Omit<Extract<ParseRequest, { kind: K }>, 'kind' | 'file'> & {
  onProgress?: (rows: number) => void
}

/** Parse a supported export in a module worker; resolves with the ImportResult, reports row progress. */
export function parseInWorker<K extends ParseKind>(
  kind: K,
  file: File,
  // Optional only when every option is (eBird's kinds).
  ...[opts]: Partial<ParseOptions<K>> extends ParseOptions<K> ? [opts?: ParseOptions<K>] : [opts: ParseOptions<K>]
): Promise<ParseResult> {
  const { onProgress, ...extra } = (opts ?? {}) as ParseOptions<K>
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
    worker.postMessage({ kind, file, ...extra })
  })
}
