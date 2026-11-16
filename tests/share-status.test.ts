// The Red List pill on share images (the "Show conservation status" option): which tiles get one, where, in what colours.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSpeciesIndex } from '@/lib/species/load'
import type { SpeciesRow } from '@/lib/species/types'
import type { ListEntry } from '@/lib/list/model'
import * as image from '@/lib/share/image'
import { en } from '@/i18n/messages/en'
import { installStubs, NOW } from './fixtures/share-image-harness'

const mk = (code: string, over: Partial<SpeciesRow> = {}) =>
  ({ code, com: code, sci: code, ord: 'Passeriformes', fam: 'Avidae', famCom: 'Birds', to: 1, g: 50, gSrc: 'family', st: true, ar: 1, q: true, ...over }) as SpeciesRow
const rows = [mk('vub', { iu: 'VU' }), mk('enb', { iu: 'EN' }), mk('crb', { iu: 'CR' }), mk('lcb', { iu: 'LC' }), mk('ntb', { iu: 'NT' }), mk('nob'),
  mk('smallvu', { iu: 'VU' }), mk('holevu', { iu: 'CR' }), mk('lifervu', { iu: 'VU' })]
const species = buildSpeciesIndex(rows)
const entries = rows.map((r) => ({ code: r.code, date: r.code === 'lifervu' ? '2026-01' : '2020-01', heard: false, dead: false, media: false, sources: ['ebird'] })) as ListEntry[]
// A 1000 x 1200 pack: the count's hole is at the middle; holevu's corner sits on it, the rest are well away.
const box = (x: number, y: number, s: number): [number, number, number, number] => [x, y, s, s]
const pack = {
  W: 1000, H: 1200,
  boxes: new Map<string, [number, number, number, number]>([
    ['vub', box(50, 50, 200)], ['enb', box(300, 50, 200)], ['crb', box(550, 50, 200)], ['lcb', box(50, 300, 200)], ['ntb', box(300, 300, 200)],
    ['nob', box(550, 300, 200)], ['smallvu', box(800, 50, 20)], ['holevu', box(430, 530, 140)], ['lifervu', box(50, 900, 200)],
  ]),
}

let logs: Map<object, string[]>
beforeEach(() => { logs = installStubs() })
afterEach(() => { vi.unstubAllGlobals() })

async function draw(status: boolean | undefined) {
  image.clearStickerCache()
  const canvas = await image.drawShareImage({ format: 'post', entries, species, pack, theme: 'light', latest: true, now: NOW, strings: en.ui, ...(status === undefined ? {} : { status }) } as never)
  return logs.get(canvas as unknown as object)!
}
/** The pill labels drawn, each with the fill colour of the rounded rect just before it. */
const pills = (log: string[]) => {
  const out: string[] = []
  for (let i = 0; i < log.length; i++) {
    const m = /^fillText\("(VU|EN|CR|LC|NT)"/.exec(log[i])
    if (m) out.push(m[1])
  }
  return out
}
const lastSet = (log: string[], prop: string, before: number) => {
  for (let i = before; i >= 0; i--) if (log[i].startsWith(`${prop} = `)) return log[i].slice(prop.length + 3)
}

describe('share image conservation status pills', () => {
  it('draws a pill for each large threatened tile, in the fixed colours, and none for LC, NT or no status', async () => {
    const log = await draw(true)
    const drawn = pills(log)
    expect(drawn).toEqual(expect.arrayContaining(['VU', 'EN', 'CR']))
    expect(drawn).not.toContain('LC')
    expect(drawn).not.toContain('NT')
    const at = (t: string) => log.findIndex((l) => l.startsWith(`fillText("${t}"`))
    expect(lastSet(log, 'fillStyle', at('VU'))).toBe('"#1e1e24"')
    expect(lastSet(log, 'fillStyle', at('EN'))).toBe('"#1e1e24"')
    expect(lastSet(log, 'fillStyle', at('CR'))).toBe('"#ffffff"')
    expect(lastSet(log, 'font', at('VU'))).toMatch(/^"600 /)
  })

  it('skips a tile under the minimum side, a pill touching the count, and the lifer', async () => {
    const drawn = pills(await draw(true))
    // vub and lifervu's collage tile, not smallvu (20px) and not the latest lifer row's own sticker (lifervu is the latest).
    expect(drawn.filter((l) => l === 'VU')).toHaveLength(2)
    expect(drawn.filter((l) => l === 'CR')).toHaveLength(1) // crb; holevu's corner is on the count
  })

  it('draws no pill with status off or absent', async () => {
    expect(pills(await draw(false))).toEqual([])
    expect(pills(await draw(undefined))).toEqual([])
  })
})
