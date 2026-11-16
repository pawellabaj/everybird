import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import type { SpeciesRow } from '../src/lib/species/types'
import { SMALL, LARGE, PRINT } from '../src/lib/sticker-url'
import { afterAll, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { MASK, decodeMask, maskCell, maskFromAlpha } from '../src/lib/layout/mask'
import { makeVariants, makePrintVariant, PRINT_WEBP, updateStickers, stickerCount } from '../scripts/build-data/build-stickers'

// fixture: 300x160 transparent canvas with an opaque 100x100 square at x100..199, y30..129
const fixture = readFileSync(resolve(__dirname, 'fixtures/build/sticker.png'))
const tmpDirs: string[] = []
const tmp = () => { const d = mkdtempSync(resolve(tmpdir(), 'eb-tier-')); tmpDirs.push(d); return d }
afterAll(() => { for (const d of tmpDirs) rmSync(d, { recursive: true, force: true }) })

describe('sticker variants', () => {
  it('variants have long side 128 and 384 and keep aspect within 1px', async () => {
    // a wide fixture: crop to 100x50 content by drawing a non-square sticker
    const wide = await sharp({ create: { width: 400, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 9, g: 9, b: 9, alpha: 1 } } }).png().toBuffer(), left: 50, top: 80 }])
      .png().toBuffer()
    const r = await makeVariants(wide)
    expect(r.ar).toBeCloseTo(2, 5)
    for (const [size, buf] of [[128, r.v128], [384, r.v384]] as const) {
      const m = await sharp(buf).metadata()
      expect(Math.max(m.width!, m.height!)).toBe(size)
      expect(Math.abs(m.height! - size / r.ar)).toBeLessThanOrEqual(1)
    }
  })

  it('trims the transparent margin (fixture becomes square)', async () => {
    const r = await makeVariants(fixture)
    expect(r.ar).toBe(1)
    const m = await sharp(r.v384).metadata()
    expect([m.width, m.height]).toEqual([384, 384])
  })
})

describe('mask', () => {
  it('mask has MASK cells on the long side and marks opaque cells', async () => {
    const { data, info } = await sharp(fixture).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const alpha = new Uint8Array(info.width * info.height)
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3]
    // untrimmed 300x160: long side 300 -> 24 cells, short 160 -> round(12.8)=13
    const [w, h, b64] = maskFromAlpha(alpha, info.width, info.height)
    expect([w, h]).toEqual([MASK, 13])
    const m = decodeMask([w, h, b64])
    // cell = 12.5 px wide, 12.3 px tall. square x100..200 -> cols 8..15; y30..130 -> rows 3..9 (full rows 3..9 partial coverage)
    for (let x = 0; x < w; x++) expect(maskCell(m, x, 0)).toBe(false)
    expect(maskCell(m, 11, 6)).toBe(true)
    expect(maskCell(m, 2, 6)).toBe(false)
    expect(maskCell(m, 20, 6)).toBe(false)
    expect(maskCell(m, 11, 12)).toBe(false)
    let set = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (maskCell(m, x, y)) set++
    expect(set).toBeGreaterThanOrEqual(8 * 6)
    expect(set).toBeLessThanOrEqual(9 * 8)
  })

  it('tall images get MASK cells on the height', () => {
    const [w, h] = maskFromAlpha(new Uint8Array(50 * 200).fill(255), 50, 200)
    expect([w, h]).toEqual([6, MASK])
  })

  it('decodeMask(maskFromAlpha(x)) round-trips', () => {
    const w = 48, h = 48, alpha = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) alpha[y * w + x] = (x + y) % 4 < 2 ? 255 : 0
    const enc = maskFromAlpha(alpha, w, h)
    const m = decodeMask(enc)
    expect(m.w).toBe(24); expect(m.h).toBe(24)
    expect(m.bits.length).toBe(Math.ceil((24 * 24) / 8))
    // re-encode bits -> base64 matches
    expect(Buffer.from(m.bits).toString('base64')).toBe(enc[2])
    // 2x2 blocks of the diagonal stripe pattern average to 127.5 -> 128 > 40 -> every cell set
    expect(m.bits.every((b) => b === 0xff)).toBe(true)
  })
})


describe('print variants', () => {
  it('trims, caps the long side at 1024 and never enlarges', async () => {
    expect(PRINT_WEBP).toEqual({ quality: 80, effort: 4 })
    for (const size of [2000, 600]) {
      const src = await sharp({ create: { width: size, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: await sharp({ create: { width: size - 40, height: 200, channels: 4, background: 'red' } }).png().toBuffer(), left: 20, top: 100 }]).png().toBuffer()
      const m = await sharp(await makePrintVariant(src)).metadata()
      expect(Math.max(m.width!, m.height!)).toBe(Math.min(1024, size - 40))
      expect(m.width! / m.height!).toBeCloseTo((size - 40) / 200, 1)
    }
  })
  it('rejects a fully transparent print source', async () => {
    const src = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
    await expect(makePrintVariant(src)).rejects.toThrow('fully transparent')
  })
})

it('updateStickers adds print only on request, keeping the 384 mask and aspect', async () => {
  const run = async (sizes?: readonly (128 | 384 | 1024)[]) => {
    const rows = [{ code: 'synthetic', st: true, ord: 'Test', sv: 'abc', ar: 0.5 } as SpeciesRow]
    const masks = new Map()
    const written = await updateStickers({ rows, masks, sizes, codes: new Set(['synthetic']),
      source: () => resolve(__dirname, 'fixtures/build/sticker.png'), out: tmp() })
    return { rows, masks, written }
  }
  const standard = await run()
  const print = await run([SMALL, LARGE, PRINT])
  expect(standard.written).toEqual(['v1/128/synthetic.abc.webp', 'v1/384/synthetic.abc.webp'])
  expect(print.written).toEqual(['v1/1024/synthetic.abc.webp', ...standard.written])
  expect(print.rows).toEqual(standard.rows)
  expect(print.masks).toEqual(standard.masks)
})

it('counts rebuilt codes by the 384 tier, independent of the other tiers', () => {
  expect(stickerCount(['v1/128/a.webp', 'v1/384/a.webp', 'v1/1024/a.webp', 'v1/384/b.x.webp'])).toBe(2)
})

it('updateStickers with print writes 128/384 byte-identical to the one-pipeline trim and resize it had before print', async () => {
  // A noisy, partly transparent synthetic sticker, so resampling differences would show in the bytes.
  const w = 220, h = 150
  const px = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, inside = x > 17 && x < 201 && y > 9 && y < 133
    px[i] = (x * 7 + y * 3) % 256; px[i + 1] = (x * y) % 256; px[i + 2] = (x ^ y) % 256; px[i + 3] = inside ? (x * 5 + y) % 256 : 0
  }
  const dir = tmp(), src = resolve(dir, 'src.png')
  writeFileSync(src, await sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer())
  // The pre-print pipeline: decode, find the alpha box, then extract + resize + webp in one sharp chain.
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 0) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  }
  const old = (size: number) => sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize(size, size, { fit: 'inside', kernel: 'lanczos3' }).webp({ quality: 80, effort: 6 }).toBuffer()
  const out = tmp()
  const rows = [{ code: 'noisy', st: true, ord: 'Test', ar: 1 } as SpeciesRow]
  await updateStickers({ rows, masks: new Map(), codes: new Set(['noisy']), source: () => src, out, sizes: [SMALL, LARGE, PRINT] })
  expect(readFileSync(resolve(out, 'v1/128/noisy.webp')).equals(await old(128))).toBe(true)
  expect(readFileSync(resolve(out, 'v1/384/noisy.webp')).equals(await old(384))).toBe(true)
  expect(readFileSync(resolve(out, 'v1/1024/noisy.webp')).equals(await makePrintVariant(src))).toBe(true)
})
