// A class selector defined in status-mark.css must not be defined in another stylesheet: the pill's first class,
// .eb-status, clashed with Settings' status lines (import.css) and the Status panel, and restyled both.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../src')
const cssFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? cssFiles(p) : p.endsWith('.css') ? [p] : []
  })
/** Every class named in a selector (the text before each `{`, comments and strings out). */
function classes(file: string): Set<string> {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"]*"|'[^']*'/g, '""')
  const out = new Set<string>()
  for (const m of css.matchAll(/([^{};]+)\{/g)) {
    if (m[1].trim().startsWith('@')) continue
    for (const c of m[1].matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(c[1])
  }
  return out
}

describe('status-mark.css classes are its own', () => {
  const own = resolve(SRC, 'components/collage/status-mark.css')
  const mine = classes(own)
  it('defines classes (the scan works)', () => {
    expect(mine.has('eb-smark')).toBe(true)
  })
  it('no class selector defined there is also defined in another stylesheet under src/', () => {
    // Classes of other components the mark's rules merely refer to (the bird, its stage, the list row, the sticker).
    const context = new Set(['eb-bird', 'eb-tile', 'eb-stage', 'eb-row-name', 'eb-st'])
    const clashes: string[] = []
    for (const f of cssFiles(SRC)) {
      if (f === own) continue
      const theirs = classes(f)
      for (const c of mine) if (!context.has(c) && theirs.has(c)) clashes.push(`.${c} is in ${f.slice(SRC.length + 1)}`)
    }
    expect(clashes).toEqual([])
  })
})
