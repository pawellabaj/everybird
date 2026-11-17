// A sticker's WebP bytes as a PNG no wider or taller than `maxSide` (Satori can't draw WebP, so the link preview embeds
// each sticker as PNG). On Node that is sharp, as before. On Cloudflare Workers sharp's native module can't load, so the
// same job runs in the Worker (sticker-png.workers.ts: libwebp in WASM to decode, fflate to encode the PNG). The Vercel
// path imports neither the WASM decoder nor anything Cloudflare-only.
import { workersEnv } from './workers-runtime'

export async function stickerPng(bytes: ArrayBuffer, maxSide?: number): Promise<Buffer> {
  if (workersEnv()) {
    const { webpToPng } = await import('./sticker-png.workers')
    return webpToPng(bytes, maxSide)
  }
  const sharp = (await import('sharp')).default
  let img = sharp(Buffer.from(bytes))
  if (maxSide) img = img.resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
  return img.png({ compressionLevel: 3 }).toBuffer()
}
