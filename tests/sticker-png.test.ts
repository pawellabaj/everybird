// The Cloudflare sticker path (src/lib/share/png.ts, sticker-png.workers.ts): the PNG it writes must be a valid RGBA
// image of the right size, and the resize must weight by alpha. Node's zlib reads the PNG back. The WebP decode itself is
// libwebp (@jsquash/webp); here it runs in Node on a synthetic sticker encoded with the same package.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { encodePngRgba, resizeRgba } from '@/lib/share/png'

type Png = { w: number; h: number; bitDepth: number; colorType: number; rows: Uint8Array }
function readPng(png: Uint8Array): Png {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)
  expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  let at = 8
  let ihdr: Uint8Array | null = null
  const idat: Uint8Array[] = []
  while (at < png.length) {
    const len = dv.getUint32(at)
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    const data = png.subarray(at + 8, at + 8 + len)
    const crc = dv.getUint32(at + 8 + len)
    expect(crc, `crc of ${type}`).toBe(crc32(png.subarray(at + 4, at + 8 + len)))
    if (type === 'IHDR') ihdr = data
    if (type === 'IDAT') idat.push(data)
    at += 12 + len
  }
  const h = new DataView(ihdr!.buffer, ihdr!.byteOffset, ihdr!.byteLength)
  const raw = new Uint8Array(inflateSync(Buffer.concat(idat)))
  return { w: h.getUint32(0), h: h.getUint32(4), bitDepth: ihdr![8], colorType: ihdr![9], rows: raw }
}
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) {
    c ^= b
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

describe('encodePngRgba', () => {
  it('writes a valid 8-bit RGBA PNG whose rows inflate back to the pixels', () => {
    const w = 3, h = 2
    const rgba = new Uint8Array(w * h * 4).map((_, i) => (i * 37) & 255)
    const png = readPng(encodePngRgba(rgba, w, h))
    expect([png.w, png.h, png.bitDepth, png.colorType]).toEqual([w, h, 8, 6])
    for (let y = 0; y < h; y++) {
      expect(png.rows[y * (w * 4 + 1)]).toBe(0) // filter: none
      expect([...png.rows.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1))]).toEqual([...rgba.subarray(y * w * 4, (y + 1) * w * 4)])
    }
  })
})

describe('resizeRgba', () => {
  it('keeps a uniform image uniform', () => {
    const src = new Uint8Array(4 * 4 * 4).fill(0).map((_, i) => [200, 100, 50, 255][i % 4])
    const out = resizeRgba(src, 4, 4, 2, 2)
    expect([...out.subarray(0, 4)]).toEqual([200, 100, 50, 255])
    expect(out.length).toBe(2 * 2 * 4)
  })
  it('weights colour by alpha, so a transparent black pixel does not darken its opaque neighbour', () => {
    // Two pixels in a row: opaque white, fully transparent black. Straight-alpha averaging would give grey 128 at alpha 128.
    const src = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 0])
    const out = resizeRgba(src, 2, 1, 1, 1)
    expect(out[3]).toBe(128) // half coverage
    expect(out[0]).toBe(255) // colour stays white
    expect(out[1]).toBe(255)
    expect(out[2]).toBe(255)
  })
  it('scales a 384 sticker down to 256 with the same aspect', () => {
    const src = new Uint8Array(384 * 384 * 4).fill(255)
    const out = resizeRgba(src, 384, 384, 256, 256)
    expect(out.length).toBe(256 * 256 * 4)
  })
})

describe('WebP to PNG in Node (libwebp via @jsquash/webp)', () => {
  it('decodes a WebP sticker and writes a PNG of the requested size', async () => {
    // The WebP comes from sharp (the repo's Node image library), with a transparent left strip like a sticker's edge.
    const sharp = (await import('sharp')).default
    // Compiled from the package's .wasm, as the Worker build does with its `?module` import.
    const { init, default: decode } = await import('@jsquash/webp/decode')
    const wasm = readFileSync(createRequire(import.meta.url).resolve('@jsquash/webp/codec/dec/webp_dec.wasm'))
    await (init as unknown as (m: WebAssembly.Module) => Promise<void>)(new WebAssembly.Module(wasm))
    const w = 384, h = 300
    const rgba = Buffer.alloc(w * h * 4)
    for (let i = 0; i < rgba.length; i += 4) {
      const x = (i / 4) % w, y = Math.floor(i / 4 / w)
      rgba[i] = x & 255; rgba[i + 1] = y & 255; rgba[i + 2] = 128; rgba[i + 3] = x < 40 ? 0 : 255
    }
    const webp = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 90 }).toBuffer()
    const back = await decode(webp.buffer.slice(webp.byteOffset, webp.byteOffset + webp.byteLength) as ArrayBuffer)
    expect([back.width, back.height]).toEqual([w, h])
    expect(back.data[3]).toBe(0) // the transparent strip survives the round trip
    const small = resizeRgba(new Uint8Array(back.data.buffer), w, h, 256, 200)
    const png = readPng(encodePngRgba(small, 256, 200))
    expect([png.w, png.h]).toEqual([256, 200])
  })
})
