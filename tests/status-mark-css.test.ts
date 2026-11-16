// The bird mark's CSS (status-mark.css): fixed Red List colours, no pointer events, never Ink or Paper, a fixed size.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { IUCN_CATS, IUCN_COLORS } from '../src/lib/species/iucn'

const css = readFileSync(resolve(__dirname, '../src/components/collage/status-mark.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]] as const)
const body = (sel: string) => rules.filter(([s]) => s === sel).map(([, b]) => b).join(' ')

describe('status-mark.css', () => {
  it('each category takes its Red List chart fill and text', () => {
    for (const c of IUCN_CATS) {
      const b = body(`.eb-status[data-cat="${c}"]`)
      expect(b, c).toContain(`--iucn-fill: ${IUCN_COLORS[c].fill}`)
      expect(b, c).toContain(`--iucn-text: ${IUCN_COLORS[c].text}`)
    }
  })
  it('draws the fill and text from those and rings in Line', () => {
    const b = body('.eb-status')
    expect(b).toMatch(/background:\s*var\(--iucn-fill\)/)
    expect(b).toMatch(/color:\s*var\(--iucn-text\)/)
    expect(b).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--line\)/)
  })
  it('takes no pointer events', () => {
    expect(body('.eb-status')).toMatch(/pointer-events:\s*none/)
  })
  it('no rule uses Ink or Paper (dark Ink is white)', () => {
    expect(css).not.toMatch(/var\(--ink\)|var\(--paper\)/)
  })
  it('keeps its size on a scaled bird: the bird\u2019s --k, inverse scale and no scale where nothing travels', () => {
    const b = body('.eb-bird > .eb-status')
    expect(b).toMatch(/--k:\s*inherit/)
    expect(b).toMatch(/scale:\s*calc\(1 \/ var\(--k\)\)/)
    expect(body('.eb-stage[data-fast] .eb-tile > .eb-status')).toMatch(/scale:\s*none/)
  })
  it('sizes: a 14px pill with 9px mono text', () => {
    expect(body('.eb-status')).toMatch(/height:\s*14px/)
    expect(body('.eb-status')).toMatch(/font:\s*600 9px\/1 var\(--font-mono\)/)
  })
  it('shares the card pill’s optical nudges (NT .09em, EX .04em, in em so they scale with the 9px font), same width', () => {
    expect(body('.eb-status[data-cat="NT"]')).toMatch(/padding:\s*0 calc\(4px - \.1125em\) 0 calc\(4px \+ \.1125em\)/)
    expect(body('.eb-status[data-cat="EX"]')).toMatch(/padding:\s*0 calc\(4px - \.0625em\) 0 calc\(4px \+ \.0625em\)/)
    expect(body('.eb-status')).toMatch(/padding:\s*0 calc\(4px - \.0225em\) 0 calc\(4px \+ \.0225em\)/)
  })
})
