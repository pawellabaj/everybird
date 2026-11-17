// Pure RGBA image code for the Workers sticker path: an alpha-weighted area-average resize and an 8-bit RGBA PNG encoder
// (fflate's deflate). No WASM, no Node, no Cloudflare: the unit tests run it directly (tests/sticker-png.test.ts).
import { zlibSync } from 'fflate'

/** One output pixel's share of each input pixel: from `start`, `w[k]` of the input's pixel (start + k), summing to 1. */
type Span = { start: number; w: Float64Array }
function axisWeights(src: number, dst: number): Span[] {
  const scale = src / dst
  const out: Span[] = []
  for (let d = 0; d < dst; d++) {
    const from = d * scale
    const to = (d + 1) * scale
    const start = Math.floor(from)
    const end = Math.ceil(to)
    const w = new Float64Array(end - start)
    for (let s = start; s < end; s++) {
      const overlap = Math.min(to, s + 1) - Math.max(from, s)
      if (overlap > 0) w[s - start] = overlap / scale
    }
    out.push({ start, w })
  }
  return out
}

/** Area-average downscale of RGBA, alpha-weighted (premultiplied) so transparent pixels don't pull colour to black. */
export function resizeRgba(src: Uint8ClampedArray | Uint8Array, sw: number, sh: number, dw: number, dh: number): Uint8Array {
  const wx = axisWeights(sw, dw)
  const wy = axisWeights(sh, dh)
  const mid = new Float64Array(sh * dw * 4) // premultiplied colour (0-255) and alpha, after the horizontal pass
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < dw; x++) {
      const { start, w } = wx[x]
      let r = 0, g2 = 0, b = 0, a = 0
      for (let k = 0; k < w.length; k++) {
        const i = (y * sw + start + k) * 4
        const al = src[i + 3]
        const f = w[k]
        r += src[i] * al / 255 * f
        g2 += src[i + 1] * al / 255 * f
        b += src[i + 2] * al / 255 * f
        a += al * f
      }
      const o = (y * dw + x) * 4
      mid[o] = r; mid[o + 1] = g2; mid[o + 2] = b; mid[o + 3] = a
    }
  }
  const out = new Uint8Array(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const { start, w } = wy[y]
    for (let x = 0; x < dw; x++) {
      let r = 0, g2 = 0, b = 0, a = 0
      for (let k = 0; k < w.length; k++) {
        const o = ((start + k) * dw + x) * 4
        const f = w[k]
        r += mid[o] * f; g2 += mid[o + 1] * f; b += mid[o + 2] * f; a += mid[o + 3] * f
      }
      const i = (y * dw + x) * 4
      const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
      out[i + 3] = clamp(a)
      // Premultiplied colour (0-255 scaled by alpha/255) back to straight colour: colour = premultiplied * 255 / alpha.
      if (a > 0) {
        out[i] = clamp((r * 255) / a)
        out[i + 1] = clamp((g2 * 255) / a)
        out[i + 2] = clamp((b * 255) / a)
      }
    }
  }
  return out
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** An 8-bit RGBA PNG (colour type 6, no filtering: each row is written with filter byte 0). */
export function encodePngRgba(rgba: Uint8Array, w: number, h: number): Uint8Array {
  const row = w * 4
  const raw = new Uint8Array((row + 1) * h)
  for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * row, (y + 1) * row), y * (row + 1) + 1)
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w)
  dv.setUint32(4, h)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    // IDAT is a zlib stream (RFC 1950), not raw deflate.
    chunk('IDAT', zlibSync(raw, { level: 6 })),
    chunk('IEND', new Uint8Array(0)),
  ]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}
