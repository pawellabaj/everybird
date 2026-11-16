// The bird mark's CSS (status-mark.css): fixed Red List colours, no pointer events, never Ink or Paper, a fixed size.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { IUCN_COLORS, THREATENED } from '../src/lib/species/iucn'

const css = readFileSync(resolve(__dirname, '../src/components/collage/status-mark.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]] as const)
const body = (sel: string) => rules.filter(([s]) => s === sel).map(([, b]) => b).join(' ')

describe('status-mark.css', () => {
  it('each threatened category (the only ones marked) takes its Red List chart fill and text; no others have a rule', () => {
    expect(rules.filter(([sel]) => /\[data-cat=/.test(sel)).map(([sel]) => sel.match(/data-cat="(\w+)"/)![1]).sort()).toEqual([...THREATENED].sort())
    for (const c of THREATENED) {
      const b = body(`.eb-smark[data-cat="${c}"]`)
      expect(b, c).toContain(`--iucn-fill: ${IUCN_COLORS[c].fill}`)
      expect(b, c).toContain(`--iucn-text: ${IUCN_COLORS[c].text}`)
    }
  })
  it('draws the fill and text from those and rings in Line', () => {
    const b = body('.eb-smark')
    expect(b).toMatch(/background:\s*var\(--iucn-fill\)/)
    expect(b).toMatch(/color:\s*var\(--iucn-text\)/)
    expect(b).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--line\)/)
  })
  it('takes no pointer events', () => {
    expect(body('.eb-smark')).toMatch(/pointer-events:\s*none/)
  })
  it('no rule uses Ink or Paper (dark Ink is white)', () => {
    expect(css).not.toMatch(/var\(--ink\)|var\(--paper\)/)
  })
  it('keeps its size on a scaled bird: the bird\u2019s --k, inverse scale and no scale where nothing travels', () => {
    const b = body('.eb-bird > .eb-smark')
    expect(b).toMatch(/--k:\s*inherit/)
    expect(b).toMatch(/scale:\s*calc\(1 \/ var\(--k\)\)/)
    expect(body('.eb-stage[data-fast] .eb-tile > .eb-smark')).toMatch(/scale:\s*none/)
  })
  it('sizes: a 14px pill with 9px mono text', () => {
    expect(body('.eb-smark')).toMatch(/height:\s*14px/)
    expect(body('.eb-smark')).toMatch(/font:\s*600 9px\/1 var\(--font-mono\)/)
  })
  it('centres its text as the card pill does (the .0225em shift balancing the letter-spacing)', () => {
    expect(body('.eb-smark')).toMatch(/padding:\s*0 calc\(4px - \.0225em\) 0 calc\(4px \+ \.0225em\)/)
  })
  it('is one base block (no second .eb-smark rule) and has no NT or EX nudges: only VU, EN and CR are marked', () => {
    expect(rules.filter(([sel]) => sel === '.eb-smark')).toHaveLength(1)
    expect(css).not.toMatch(/data-cat="(LC|NT|EW|EX|DD)"/)
  })
  it('glides with the bird: its scale and translate take the bird\u2019s .64s, easing and delay, off wherever the bird\u2019s are', () => {
    const b = body('.eb-bird > .eb-smark')
    expect(b).toMatch(/--md:\s*inherit/)
    expect(b).toMatch(/transition:\s*scale \.64s var\(--eb-travel\) var\(--md\),\s*translate \.64s var\(--eb-travel\) var\(--md\)/)
    const off = rules.find(([sel]) => sel.includes('.eb-bird[data-enter] > .eb-smark'))!
    for (const sel of ['.eb-bird[data-enter] > .eb-smark', '.eb-stage[data-instant] .eb-tile > .eb-smark', '.eb-stage:not([data-ready]) .eb-tile > .eb-smark', '.eb-stage[data-fast] .eb-tile > .eb-smark']) {
      expect(off[0], sel).toContain(sel)
    }
    expect(off[1]).toMatch(/transition:\s*none/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.eb-bird > \.eb-smark\s*\{\s*transition:\s*none/)
  })
  it('matches the bird\u2019s own transition in collage.css (same duration, easing variable and delay)', () => {
    const bird = readFileSync(resolve(__dirname, '../src/components/collage/collage.css'), 'utf8')
    expect(bird).toContain('translate .64s var(--eb-travel) var(--md)')
    expect(bird).toContain('scale .64s var(--eb-travel) var(--md)')
  })
  it('stays hidden until its sticker has loaded (an outline bird has no img.eb-st, so its pill shows at once)', () => {
    expect(body('img.eb-st:not([data-ld]) ~ .eb-smark')).toMatch(/visibility:\s*hidden/)
  })
})
