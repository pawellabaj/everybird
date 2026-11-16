// The list row pill's CSS (status-mark.css): fixed Red List colours, no pointer events, never Ink or Paper, a fixed size.
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
})
