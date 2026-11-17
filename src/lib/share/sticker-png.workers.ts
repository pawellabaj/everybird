// The Cloudflare Workers half of sticker-png.ts: WebP bytes in, a PNG out, with no native code. libwebp (@jsquash/webp,
// WASM, compiled at build time through the `?module` import) decodes the sticker; a box (area-average) resize, with alpha
// weighting so a transparent edge doesn't darken the colour, scales it down; fflate's deflate writes the PNG. Only ever
// reached on Cloudflare Workers, through a dynamic import, so the Vercel build never bundles the WASM into its path.
import { encodePngRgba, resizeRgba } from './png'
import decode, { init } from '@jsquash/webp/decode'
import webpDecoder from '@jsquash/webp/codec/dec/webp_dec.wasm?module'

let ready: Promise<void> | undefined
/** libwebp's WASM from the compiled module (the package's own loader fetches a URL, which Workers don't have). */
function decoderReady(): Promise<void> {
  ready ??= (init as unknown as (m: WebAssembly.Module) => Promise<void>)(webpDecoder)
  return ready
}

// The emscripten build reads `ImageData` from the global scope, which a Worker doesn't define.
const g = globalThis as unknown as { ImageData?: unknown }
if (!g.ImageData) {
  g.ImageData = class ImageData {
    constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
  }
}

/** WebP bytes as a PNG, scaled to fit `maxSide` (never up), as sharp's `resize({ fit: 'inside', withoutEnlargement })`. */
export async function webpToPng(bytes: ArrayBuffer, maxSide?: number): Promise<Buffer> {
  await decoderReady()
  const img = await decode(bytes)
  let { width: w, height: h } = img
  let rgba: Uint8Array = new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength)
  if (maxSide && (w > maxSide || h > maxSide)) {
    const s = maxSide / Math.max(w, h)
    const dw = Math.max(1, Math.round(w * s))
    const dh = Math.max(1, Math.round(h * s))
    rgba = resizeRgba(rgba, w, h, dw, dh)
    w = dw
    h = dh
  }
  const png = encodePngRgba(rgba, w, h)
  return Buffer.from(png.buffer, png.byteOffset, png.byteLength)
}
