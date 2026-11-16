// The generated continent globes (src/lib/places/continent-shapes.ts, from scripts/build-data/build-continent-shapes.ts):
// seven entries, one land path each, whole numbers inside the 256 viewBox, and the byte limits.
import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTINENTS } from '@/lib/places/continents'
import { CONTINENT_GLOBES, CONTINENT_VIEWBOX } from '@/lib/places/continent-shapes'

const IDS = CONTINENTS.map((c) => c.id).sort()
const MODULE = resolve(__dirname, '../src/lib/places/continent-shapes.ts')

/** The numbers of a path's d string, read in pairs. */
function points(d: string): [number, number][] {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const pairs: [number, number][] = []
  for (let i = 0; i + 1 < nums.length; i += 2) pairs.push([nums[i], nums[i + 1]])
  return pairs
}

describe('continent globes', () => {
  it('has the view box the component expects', () => {
    expect(CONTINENT_VIEWBOX).toBe('0 0 256 256')
  })

  it('has exactly one entry per continent, and no others', () => {
    expect(Object.keys(CONTINENT_GLOBES).sort()).toEqual(IDS)
    expect(Object.keys(CONTINENT_GLOBES)).toHaveLength(7)
  })

  it.each(IDS)('%s: a land path of moves and closed loops, inside the view box', (id) => {
    const d = CONTINENT_GLOBES[id]
    expect(d).toMatch(/^M[\d\s.-]+Z/)
    expect(d).toMatch(/^[MZ\d\s.-]+$/)
    const pts = points(d)
    expect(pts.length).toBeGreaterThanOrEqual(3)
    expect(Buffer.byteLength(d)).toBeGreaterThanOrEqual(300)
    for (const [x, y] of pts) {
      expect(Number.isInteger(x)).toBe(true)
      expect(Number.isInteger(y)).toBe(true)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(256)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(256)
    }
  })

  it.each(IDS)('%s: under 1.2 KB', (id) => {
    expect(Buffer.byteLength(CONTINENT_GLOBES[id])).toBeLessThan(1200)
  })

  it('keeps the module under 10 KB', () => {
    expect(statSync(MODULE).size).toBeLessThan(10 * 1024)
  })
})
