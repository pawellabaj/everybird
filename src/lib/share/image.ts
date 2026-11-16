// Share images: a story (1080 × 1920), post (1080 × 1350) or square (1080 × 1080) PNG of the collage, or of the current filtered view,
// and the print poster's card (A4 to A1, drawn by poster code in strips).
//
// Layout (cardLayout), on Paper with 64px side margins, all text left-aligned. It leads with the birder, not the
// product: people share a brag, not an app card.
//   top     the name, if given (Cabinet Grotesk 700, 56px), then the count (Cabinet 96px, "197 species"), then, for a
//           filtered view, the filter in words (Satoshi 500 32px, Accent)
//   middle  the collage, packed for the space left (layout worker 'image' message: packFrame, the count's hole at its
//           centre); no sticker longer than 30% of the collage wide (36% up to 24 birds)
//   bottom  a Hairline rule, "Latest lifer: Western Grebe · Sep 2026" (Satoshi 32px; unless the dialog's "Show latest
//           lifer" switch is off, when the collage takes its room), then the footer: the Everybird wordmark and one
//           quiet line beside it, the site, the sticker credit and the date the image was made
//           ("everybird.yusuftaleb.com · stickers by huashu · 14 Nov 2026", stamp.ts; Geist Mono 20px, Muted).
//           The full credit, with the licence, travels in the share text.
// The story keeps Instagram's safe zones clear: nothing in the top 160px (the profile row; the title from 184) or the
// bottom 156px (the reply bar); the post and the square use 64px margins all round. The story's collage is tall (about 952 × 1284 with
// a name and the latest lifer): packFrame packs it for that aspect (the spiral stretched to it, as the narrow layout's
// 0.55), so it is a tall rounded cluster, and fitPack spreads a short list's ring to its height (SPREAD).
// Stickers load with crossOrigin = 'anonymous' (the stickers site sends access-control-allow-origin: *), so the
// canvas stays exportable. Species without a sticker, and stickers that fail to load, are drawn as a thin outline of
// the Phosphor Bird in Line (a solid silhouette would be the heaviest shape in the image). Text waits for the real
// fonts (document.fonts.load) before drawing.
//
// Two steps: prepareCard computes everything (layout, pack, fit, tiles and their URLs, text, fonts, where the footer
// line goes) and paintCard only draws it, in 1080-wide design units under the caller's transform, culling tiles to a
// y-range (tileInRange) but never text. drawShareImage is the two on one canvas at identity.
// The print poster ('print', print.ts) is the same card 1080 units wide and as tall as its A size (printDesignH), with
// 64px margins all round, in the dialog's theme, packed once at PRINT_DESIGN_H; prepareCard's `scale` (device px per unit)
// picks its sticker tier (printStickerUrl: 1024 with the 384 fallback for big tiles), and the poster paints it in strips.
import { SHARE_ORIGIN } from '@/lib/share/origin'
import { BIRD_PATH, OUTLINE_SCALE } from '@/lib/bird-outline'
import { printStickerUrl, stickerUrl } from '@/lib/sticker-url'
import { PRINT_DESIGN_H, PRINT_DESIGN_W, printDesignH, type PrintSize } from '@/lib/share/print'
import { formatDate } from '@/lib/format'
import { stampDate, withStamp } from '@/lib/share/stamp'
import type { Box } from '@/lib/layout/pack'
import { COMMA_DROP, DIGIT_CAP, LABEL, MONO_CAP, MONO_LINE, NUM_LINE, columnBoxes, countText, labelEm, numberEm, scaleHole, type Hole } from '@/lib/layout/count-box'
import type { ListEntryMsg, WorkerReply, WorkerRequest } from '@/lib/layout/layout.worker'
import { latestLifer } from '@/lib/list/build-list'
import { countriesLabel, placesLabel, statusLabel } from '@/lib/list/filter-summary'
import type { Filter } from '@/lib/list/filters'
import { rangeLabel } from '@/lib/list/timeline'
import type { ListEntry } from '@/lib/list/model'
import type { SpeciesIndex } from '@/lib/species/load'
import type { Regions } from '@/lib/species/types'
import { orderLabel } from '@/lib/species/orders'

export type ImageFormat = 'story' | 'post' | 'square' // 1080×1920, 1080×1350, 1080×1080
export const IMAGE_SIZE: Record<ImageFormat, [w: number, h: number]> = { story: [1080, 1920], post: [1080, 1350], square: [1080, 1080] }
/** A card's format: a share image, or the print poster (1080 design units wide, the A size's height; print.ts). */
export type CardFormat = ImageFormat | 'print'
/** The longest name the dialog accepts: what a share link carries (link.ts NAME_MAX; a test keeps them equal). */
export const NAME_MAX_LEN = 40
/** The footer's site name: the share origin's host ("everybird.yusuftaleb.com"). */
export const SITE_LABEL = new URL(SHARE_ORIGIN).host
/**
 * The footer's one line beside the wordmark on share images and link previews: the site and the sticker credit. Share
 * images end it with the date stamp (stamp.ts withStamp); link previews don't.
 */
export const FOOTER_LINE = `${SITE_LABEL} · stickers by huashu`
/** The full sticker credit (CC BY 4.0), for the share sheet's text: the image itself carries FOOTER_LINE. */
export const SHARE_CREDIT = 'Stickers: huashu-bird-sticker (CC BY 4.0) github.com/alchaincyf/huashu-bird-sticker'

/** The design tokens (tokens.css; a test keeps them equal). The image follows the page's current theme. */
export const SHARE_COLORS = {
  light: { ink: '#1e1e24', paper: '#f6f4ef', accent: '#92140c', muted: '#5f5f69', line: '#857f74', hairline: '#dedad2', surface: '#ebe8e1' },
  dark: { ink: '#ffffff', paper: '#1e1e24', accent: '#f06a5f', muted: '#a9a9b2', line: '#76767f', hairline: '#3d3d45', surface: '#28282f' },
} as const
export type ShareColors = { [K in keyof typeof SHARE_COLORS.light]: string }

/**
 * The latest lifer row's two lines: the mono label "Latest lifer · Sep 2026" (the date part only when there is one)
 * and the bird's name.
 */
export function latestText(latest: { com: string; date?: string }): { label: string; name: string } {
  const d = formatDate(latest.date)
  return { label: `Latest lifer${d ? ` · ${d}` : ''}`, name: latest.com }
}

/**
 * The current filter in words, birds then status then places then time: "Egypt · 2026", "Herons · Canada + Egypt",
 * "Herons · Threatened · Canada" (filter-summary.ts statusLabel); a range reads
 * "Mar 2020 to Jun 2021" (timeline.ts rangeLabel). With `regions`, places at every level by their short names
 * ("Owls · British Columbia"); without, the countries only.
 * Undefined when nothing is filtered.
 */
export function filterLabel(
  f: Filter,
  ctx: { species: SpeciesIndex; countryName: (iso2: string) => string; regions?: Pick<Regions, 'countries' | 'sub1'> },
): string | undefined {
  // Places: "Canada", "Canada + Egypt", "Capital and 2 more".
  const place = ctx.regions ? placesLabel(f, ctx.regions) : countriesLabel(f.countries, ctx.countryName)
  const parts: string[] = []
  if (f.family) parts.push(ctx.species.rows.find((r) => r.fam === f.family)?.famCom || f.family)
  else if (f.order) parts.push(orderLabel(f.order))
  const status = statusLabel(f.statuses)
  if (status) parts.push(status)
  if (place) parts.push(place)
  const range = rangeLabel(f.from, f.to)
  if (range) parts.push(range)
  else if (f.year) parts.push(f.year)
  return parts.length ? parts.join(' · ') : undefined
}

// --- layout ---

const M = 64
/**
 * Clear of the platform's own chrome: a story keeps the top 160px (the progress bar and the profile row) and the bottom
 * 156px (the reply bar) empty; the post and the square use 64px margins all round. The story's numbers come from a real
 * Instagram story (2026-11-06): its title starts at 184 (TITLE_TOP), with air under the profile row, and the footer
 * ends about 150px of the phone's screen above "Say something", in the band the reply bar leaves empty.
 */
export const SAFE: Record<CardFormat, { top: number; bottom: number }> = {
  story: { top: 160, bottom: 156 }, post: { top: M, bottom: M }, square: { top: M, bottom: M }, print: { top: M, bottom: M },
}
/** Where the title starts (the collage starts at SAFE.top when there's no title). */
export const TITLE_TOP: Record<CardFormat, number> = { story: 184, post: M, square: M, print: M }
/**
 * The gaps (px) between the head and the collage, the collage and the latest lifer row, and that row and the hairline.
 * The story, the post and the print keep them tighter so their collages take the height; the square keeps its own.
 */
const GAPS: Record<CardFormat, { head: number; collage: number; latest: number }> = {
  story: { head: 40, collage: 32, latest: 24 }, post: { head: 40, collage: 32, latest: 24 }, square: { head: 48, collage: 40, latest: 32 },
  print: { head: 40, collage: 32, latest: 24 },
}
/**
 * How far fitPack may spread the birds' centres vertically to fill a tall collage (sizes kept, distances only grow):
 * the story's tall frame most, the post's a little, the square not at all. The print (about 0.71 wide to tall) sits
 * between the story and the post.
 */
export const SPREAD: Record<CardFormat, number> = { story: 1.6, post: 1.25, square: 1, print: 1.4 }
/**
 * The count's largest size (Cabinet Grotesk 700, px) per format; it shrinks for long numbers (countLayout). It reads
 * as a label in the ring, in /lifelist's proportion: "197" is about 17% of the collage wide (the site's medium
 * layout: 11.5%, narrow: 16%).
 */
const COUNT_MAX: Record<CardFormat, number> = { story: 112, post: 104, square: 96, print: 112 }
/** The link preview's (1200 × 630, a 640px collage). */
export const OG_COUNT_MAX = 72
/**
 * The number is never wider than this share of the collage's width (measured with count-box.ts's widths): "197" stays
 * at the format's largest size, "1,089" and "11,019" shrink so the hole doesn't eat the collage.
 */
const COUNT_W = 0.26
/** Air between the count's text and the edge of its hole, as a share of the number's size (as the collage's 0.17 F). */
const COUNT_PAD = 0.17

type Text = { y: number; size: number }
/** The count at the centre of the collage: the number (size, px), the mono label under it, and the hole kept for them. */
export type CountLayout = {
  number: string
  label: string
  size: number
  labelSize: number
  /** Gap between the number's baseline and the label's cap line. */
  gap: number
  /** The hole (px, about the collage's centre) the packer keeps empty: the drawn text's boxes, grown by its pad. */
  hole: Hole
}
export type CardLayout = {
  W: number
  H: number
  name?: Text
  filter?: Text
  collage: { x: number; y: number; w: number; h: number }
  count: CountLayout
  /** The latest lifer row: its sticker (icon, px square) beside two lines, a mono label and the bird's name. */
  latest?: { y: number; icon: number; label: number; name: number }
  rule: { y: number }
  footer: Text & { credit: number }
  /** The largest sticker's long side as a share of the collage width (maxTileFrac of the count). */
  maxTile: number
}
export type CardContent = { name: boolean; filter: boolean; latest: boolean; count: number }

/**
 * The count in the middle, as the app's Tally and /lifelist's .yt-ll-mid: the shown count over "SPECIES" (a filtered
 * view too: the filter label on top says what it is). The number shrinks so it never takes more than COUNT_W of the
 * collage's width. `format` sets the largest size (or pass it in px: the link preview's smaller card).
 * The hole holds the text as renderShareImage draws it: one column centred on the collage's centre, the digits' height
 * (the comma's foot below the baseline counted in), the gap, the label's caps.
 */
export function countLayout(format: CardFormat | number, count: number, collageW: number): CountLayout {
  const max = typeof format === 'number' ? format : COUNT_MAX[format]
  const number = countText(count)
  const label = LABEL
  const em = numberEm(number)
  const size = Math.round(Math.min(max, (COUNT_W * collageW) / em))
  // The label: a fifth of the number up to 22px, never under 18px on the share images (a long count's number is smaller).
  const labelSize = Math.round(Math.max(Math.min(22, size * 0.2), Math.min(28, size * 0.14), typeof format === 'number' ? 0 : 18))
  const gap = Math.round(size * 0.14)
  const drop = COMMA_DROP * size
  const boxes = columnBoxes(em * size, DIGIT_CAP * size + drop, gap - drop, labelEm(label) * labelSize, MONO_CAP * labelSize)
  return { number, label, size, labelSize, gap, hole: { ...boxes, pad: COUNT_PAD * size } }
}

/**
 * The link preview's hole for its count (px): satori draws the column with line boxes, the number on a 0.85 line box,
 * the label on a 1.3 one (opengraph-image.tsx sets both), 0.6 x the gap between them.
 */
export function ogCountHole(K: CountLayout): Hole {
  const em = numberEm(K.number)
  const boxes = columnBoxes(em * K.size, Math.max(NUM_LINE, DIGIT_CAP + COMMA_DROP) * K.size, K.gap * 0.6 - Math.max(0, DIGIT_CAP + COMMA_DROP - NUM_LINE) * K.size, labelEm(K.label) * K.labelSize, MONO_LINE * K.labelSize)
  return { ...boxes, pad: COUNT_PAD * K.size }
}

/**
 * Where everything goes; text y is the top of its em box (textBaseline 'top'). The count sits at the collage's centre.
 * `H` is the card's height: the image's own by default, PRINT_DESIGN_H for the print (pass printDesignH(size) to lay
 * out one A size exactly).
 */
export function cardLayout(format: CardFormat, c: CardContent, H: number = format === 'print' ? PRINT_DESIGN_H : IMAGE_SIZE[format][1]): CardLayout {
  const W = format === 'print' ? PRINT_DESIGN_W : IMAGE_SIZE[format][0]
  const { top: T, bottom: B } = SAFE[format]
  // Top: only the name and the filter in words; with neither, the collage starts at the safe line.
  const name = c.name ? { y: TITLE_TOP[format], size: 60 } : undefined
  const filter = c.filter ? { y: name ? name.y + 76 : T, size: 34 } : undefined
  const headBottom = filter ? filter.y + filter.size : name ? name.y + name.size : undefined
  // Bottom, upwards: the footer (wordmark, site and credit on one line), a hairline, the latest lifer row.
  // The story's footer sits 4px higher so its descenders ("y", "(") clear the bottom safe line too.
  const footer = { y: H - B - 30 - (format === 'story' ? 4 : 0), size: 30, credit: 20 }
  const rule = { y: footer.y - 30 }
  const icon = format === 'story' || format === 'print' ? 76 : 68 // post and square 68
  const G = GAPS[format]
  const latest = c.latest ? { y: rule.y - G.latest - icon, icon, label: 20, name: 34 } : undefined
  const top = headBottom === undefined ? T : headBottom + G.head
  const bottom = (latest ? latest.y : rule.y) - G.collage
  const collage = { x: M, y: top, w: W - 2 * M, h: bottom - top }
  return { W, H, name, filter, collage, count: countLayout(format, c.count, collage.w), latest, rule, footer, maxTile: maxTileFrac(c.count) }
}

/** What the layout worker packs for: the collage frame's aspect and the hole as fractions of the frame's width. */
export type PackSpec = { aspect: number; hole: Hole; maxTile: number }
export function packSpec(L: CardLayout): PackSpec {
  const { w, h } = L.collage
  return { aspect: w / h, hole: scaleHole(L.count.hole, 1 / w), maxTile: L.maxTile }
}

/**
 * Largest a sticker is drawn (long side) as a share of the collage's width: 30%, or 36% for a short list (up to 24
 * birds) so its ring around the count fills more of the frame. Either stays under the 384px files' sharpness.
 */
export const MAX_TILE = 0.3, MAX_TILE_SHORT = 0.36
export const maxTileFrac = (n: number) => (n <= 24 ? MAX_TILE_SHORT : MAX_TILE)
/** That largest side in px (never past 440, the 384px files' sharp size). */
export function maxTileSide(collageW: number, frac = MAX_TILE): number {
  return Math.min(440, collageW * frac)
}

// --- packing (off the main thread) ---

export type ImagePack = { W: number; H: number; boxes: Map<string, Box> }

/**
 * Pack `entries` for the collage frame (spec: its aspect and the count's hole) in a short-lived layout worker ('image'
 * message; relative sizes over these entries). Aborting terminates the worker and rejects with an AbortError.
 */
export function packForImage(entries: ListEntry[], species: SpeciesIndex, spec: PackSpec, signal?: AbortSignal): Promise<ImagePack> {
  const birds: ListEntryMsg[] = []
  for (const e of entries) {
    const row = species.byCode.get(e.code)
    if (row) birds.push({ code: e.code, mass: row.g, ord: row.ord })
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const w = new Worker(new URL('../layout/layout.worker.ts', import.meta.url), { type: 'module' })
    const done = () => { w.terminate(); signal?.removeEventListener('abort', onAbort) }
    const onAbort = () => { done(); reject(abortError()) }
    signal?.addEventListener('abort', onAbort)
    w.onmessage = (e: MessageEvent<WorkerReply>) => {
      done()
      try { resolve(packFromReply(e.data)) } catch (err) { reject(err) }
    }
    w.onerror = (e) => { done(); reject(new Error(`layout worker failed: ${e.message ?? 'error'}`)) }
    const msg: WorkerRequest = { type: 'image', id: 1, entries: birds, aspect: spec.aspect, hole: spec.hole, maxTile: spec.maxTile }
    w.postMessage(msg)
  })
}
/** The worker's reply as an ImagePack: boxes [x, y, w, h] per code, in the reply's order. Throws on an error reply. */
export function packFromReply(r: WorkerReply): ImagePack {
  if (r.type !== 'image') throw new Error(r.type === 'error' ? r.message : 'unexpected layout reply')
  const boxes = new Map<string, Box>()
  r.codes.forEach((c, i) => boxes.set(c, [r.boxes[4 * i], r.boxes[4 * i + 1], r.boxes[4 * i + 2], r.boxes[4 * i + 3]]))
  return { W: r.W, H: r.H, boxes }
}

/** The error a cancelled render (or a superseded one, in the dialog) rejects with. */
export const abortError = (message = 'share image cancelled') => {
  const e = new Error(message)
  e.name = 'AbortError'
  return e
}

/**
 * What to pack for a format and a view: the collage frame (with or without the name, the filter line and the latest
 * lifer) and the count's hole. The dialog packs once per format, name-or-not and lifer-or-not; the drawing maps the pack onto
 * whatever frame it gets. The print packs once at PRINT_DESIGN_H for every A size.
 */
export function imagePackSpec(format: CardFormat, c: CardContent): PackSpec {
  return packSpec(cardLayout(format, c))
}

// --- drawing ---

const LOADS_AT_ONCE = 12
const LOAD_TIMEOUT_MS = 20_000 // per sticker
/** All stickers of one render must arrive within this; whatever is still pending is drawn as the silhouette. */
export const LOAD_BUDGET_MS = 40_000

const images = new Map<string, Promise<HTMLImageElement | null>>()
// Bumped by clearStickerCache: loads started before it never write to the cache again.
let generation = 0
/** Drop the loaded stickers (the dialog keeps them while open, for fast re-renders, and calls this on close). */
export function clearStickerCache(): void {
  generation++
  images.clear()
}
/** Test hook: how many stickers the cache holds (loaded or loading). */
export function stickerCacheSize(): number {
  return images.size
}

/**
 * A sticker as a CORS-clean image, or null if it fails, times out or `signal` aborts (an abort also stops the fetch).
 * Only successes stay cached, and only while the cache hasn't been cleared since the load began.
 */
function loadSticker(url: string, signal?: AbortSignal): Promise<HTMLImageElement | null> {
  const hit = images.get(url)
  if (hit) return hit
  const gen = generation
  const p: Promise<HTMLImageElement | null> = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    const finish = (v: HTMLImageElement | null) => {
      clearTimeout(t)
      signal?.removeEventListener('abort', stop)
      img.onload = img.onerror = null
      resolve(v)
    }
    const stop = () => { img.removeAttribute('src'); finish(null) }
    const t = setTimeout(() => finish(null), LOAD_TIMEOUT_MS)
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => finish(img)
    img.onerror = () => finish(null)
    signal?.addEventListener('abort', stop)
    img.src = url
  }).then((img) => {
    if ((!img || gen !== generation || signal?.aborted) && images.get(url) === p) images.delete(url)
    return img
  })
  images.set(url, p)
  return p
}

/**
 * Load `urls`, LOADS_AT_ONCE at a time. Resolves when all have settled or when the budget (counted from this call)
 * runs out: a URL missing from the result, or mapped to null, is drawn as the silhouette. On abort, stops pulling
 * URLs, stops the loads in flight and rejects with an AbortError.
 */
export async function loadStickers(
  urls: string[], opts: { signal?: AbortSignal; budgetMs?: number } = {},
): Promise<Map<string, HTMLImageElement | null>> {
  const { signal, budgetMs = LOAD_BUDGET_MS } = opts
  if (signal?.aborted) throw abortError()
  const out = new Map<string, HTMLImageElement | null>()
  let over = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const budget = new Promise<void>((resolve) => { timer = setTimeout(() => { over = true; resolve() }, budgetMs) })
  let onAbort = () => {}
  const aborted = new Promise<never>((_, reject) => { onAbort = () => reject(abortError()) })
  aborted.catch(() => {})
  signal?.addEventListener('abort', onAbort)
  let next = 0
  const stopped = () => over || !!signal?.aborted
  const worker = async () => {
    while (next < urls.length && !stopped()) {
      const u = urls[next++]
      const img = await Promise.race([loadSticker(u, signal), budget.then(() => null)])
      if (!stopped()) out.set(u, img)
    }
  }
  try {
    await Promise.race([Promise.all(Array.from({ length: Math.min(LOADS_AT_ONCE, urls.length) }, worker)), budget, aborted])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
  if (signal?.aborted) throw abortError()
  return out
}

export type Tile = {
  x: number; y: number; w: number; h: number; url: string | null
  /** The print's 384 file, tried when its 1024 file (`url`) fails; absent or null otherwise. */
  fallback?: string | null
}
/** A band of the card in design units, top (y0) to bottom (y1): the part a poster strip paints. */
export type PaintRange = { y0: number; y1: number }
/**
 * Whether a tile reaches into `range`, with 1 design unit of margin on both sides (antialiased edges and rounding).
 * The one test for culling: paintTiles draws exactly these tiles, and the poster loads and releases stickers by it,
 * so a tile is never drawn without its image.
 */
export function tileInRange(t: { y: number; h: number }, range: PaintRange): boolean {
  return t.y < range.y1 + 1 && t.y + t.h > range.y0 - 1
}
/**
 * Draw the collage's tiles: the sticker when it loaded, else a thin outline of the bird in `line` (never a hole). With
 * `range`, only the tiles tileInRange keeps.
 */
export function paintTiles(
  ctx: CanvasRenderingContext2D, tiles: Tile[], imgs: Map<string, CanvasImageSource | null>, line: string, range?: PaintRange,
): void {
  const bird = new Path2D(BIRD_PATH)
  for (const t of tiles) {
    if (range && !tileInRange(t, range)) continue
    const img = t.url ? imgs.get(t.url) : null
    if (img) {
      ctx.drawImage(img, t.x, t.y, t.w, t.h)
      continue
    }
    // Outline: the icon's 256 grid, fitted (contain) at OUTLINE_SCALE of the tile and centred, stroked 2px thin at any
    // scale, so a missing sticker reads as a quiet placeholder, not the darkest shape in the image.
    const k = (OUTLINE_SCALE * Math.min(t.w, t.h)) / 256
    ctx.save()
    ctx.translate(t.x + (t.w - 256 * k) / 2, t.y + (t.h - 256 * k) / 2)
    ctx.scale(k, k)
    ctx.strokeStyle = line
    ctx.lineWidth = 2 / k
    ctx.lineJoin = 'round'
    ctx.stroke(bird)
    ctx.restore()
  }
}

/** The families canvas text uses: the page's own fonts (Fontshare and next/font), with the CSS fallbacks. */
function families(): { display: string; body: string; mono: string } {
  let mono = ''
  if (typeof document !== 'undefined') mono = getComputedStyle(document.documentElement).getPropertyValue('--font-geist-mono').trim()
  return {
    display: '"Cabinet Grotesk", "Satoshi", system-ui, sans-serif',
    body: '"Satoshi", system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: `${mono ? `${mono}, ` : ''}"Geist Mono", ui-monospace, Menlo, monospace`,
  }
}

/** Wait (at most 3 s) for each font the image uses, so the canvas draws with the real faces. */
async function fontsReady(fonts: string[], sample: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const load = Promise.all(fonts.map((f) => document.fonts.load(f, sample).catch(() => [])))
  await Promise.race([load, new Promise((r) => setTimeout(r, 3000))])
}

/** Set the font at `size`, shrinking (to `min`) and then ellipsizing so `text` fits `maxW`; returns the text to draw. */
function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, size: number, min: number, maxW: number): string {
  let px = size
  ctx.font = font(px)
  while (px > min && ctx.measureText(text).width > maxW) ctx.font = font((px -= 2))
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

/** The smallest size the footer line takes beside the wordmark before it moves to its own line. */
export const CREDIT_MIN = 17
/**
 * Where the footer line (the site and "stickers by huashu") goes, never truncated and never without the credit: beside
 * the wordmark (`inlineRoom` px) at `size` down to CREDIT_MIN, else on its own line (`fullRoom` px) at `size`,
 * shrinking only if even the full width is too narrow. `measure(px)` is the line's width at that size.
 */
export function placeCredit(measure: (px: number) => number, inlineRoom: number, fullRoom: number, size: number): { size: number; below: boolean } {
  for (let px = size; px >= CREDIT_MIN; px--) if (measure(px) <= inlineRoom) return { size: px, below: false }
  let px = size
  while (px > 8 && measure(px) > fullRoom) px--
  return { size: px, below: true }
}

export type ShareImageOpts = {
  format: CardFormat
  entries: ListEntry[]
  species: SpeciesIndex
  filterLabel?: string
  name?: string
  /** The page's theme. The print follows it too: dark is light ink on the dark paper. */
  theme: 'light' | 'dark'
  /** The print's A size (print only; default A4): the card's height is printDesignH(size). */
  printSize?: PrintSize
  /** A pack made earlier by packForImage for this format, these entries, name-or-not and lifer-or-not (the dialog keeps them). */
  pack?: ImagePack
  /** When the image is made, for the footer's date stamp; default `new Date()`. */
  now?: Date
  /** The latest lifer row; default true. False leaves it out and gives its room to the collage (cardLayout's `latest: false`). */
  latest?: boolean
  signal?: AbortSignal
}

/** The share image as a PNG (the print: its 1080-wide preview). Throws an AbortError when `signal` aborts. */
export async function renderShareImage(opts: ShareImageOpts): Promise<Blob> {
  const canvas = await drawShareImage(opts)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), 'image/png')
  })
}

/**
 * `grow`: how much the scale-up past the width fit enlarged the birds (and the hole), at least 1. `sy`: the extra
 * vertical spread of the birds' centres (not their sizes) above the centre, `syDown` below it, each at least 1.
 */
export type PackFit = { s: number; cx: number; cy: number; ux: number; uy: number; grow: number; sy: number; syDown: number }
/** Where a tile's centre lands vertically: above the centre spread by `sy`, below by `syDown`. */
export const spreadY = (f: PackFit, yc: number) => f.cy + (yc - f.uy) * f.s * (yc < f.uy ? f.sy : f.syDown)
/**
 * How a pack lands on the collage area: the frame's centre (the hole) on the area's centre, the frame's width on the
 * area's width (or its height, if that is tighter), then scaled about the centre until the birds reach the area's
 * edge or the largest tile reaches `maxTile` px. Then, up to `spreadMax` (the story's tall frame), the birds' centres
 * spread vertically until the top or bottom bird reaches the area's edge: sizes are kept and distances only grow, so
 * nothing overlaps, and the ring and its hole become a taller oval. A layout unit at (x, y) is drawn at
 * (cx + (x − ux)·s, cy + (y − uy)·s) before the spread; a tile's centre moves to cy + (yc − uy)·s·sy.
 */
export function fitPack(pack: ImagePack, area: { x: number; y: number; w: number; h: number }, maxTile: number, spreadMax = 1): PackFit {
  const ux = pack.W / 2, uy = pack.H / 2
  const cx = area.x + area.w / 2, cy = area.y + area.h / 2
  const k = Math.min(area.w / pack.W, area.h / pack.H)
  let dx = 0, dy = 0, maxL = 0
  for (const [x, y, w, h] of pack.boxes.values()) {
    dx = Math.max(dx, ux - x, x + w - ux)
    dy = Math.max(dy, uy - y, y + h - uy)
    maxL = Math.max(maxL, w, h)
  }
  if (!maxL) return { s: k, cx, cy, ux, uy, grow: 1, sy: 1, syDown: 1 }
  const fill = Math.min(area.w / 2 / (dx * k), area.h / 2 / (dy * k), maxTile / (maxL * k))
  const s = k * fill
  // Above and below the centre spread separately, so a lopsided ring (one big bird low) still reaches both edges.
  let up = spreadMax, down = spreadMax
  for (const [, y, , h] of pack.boxes.values()) {
    const c = (y + h / 2 - uy) * s
    const room = (area.h / 2 - (h * s) / 2) / Math.abs(c)
    if (c < -1e-6) up = Math.min(up, room)
    else if (c > 1e-6) down = Math.min(down, room)
  }
  return { s, cx, cy, ux, uy, grow: Math.max(1, fill), sy: Math.max(1, up), syDown: Math.max(1, down) }
}

/** The canvas fonts of one card, as functions of the size in px. */
export type CardFonts = Record<'name' | 'filter' | 'count' | 'mono' | 'lifer' | 'brand' | 'footer', (px: number) => string>
function cardFonts(): CardFonts {
  const F = families()
  return {
    name: (px) => `700 ${px}px ${F.display}`,
    filter: (px) => `500 ${px}px ${F.body}`,
    count: (px) => `700 ${px}px ${F.display}`,
    mono: (px) => `500 ${px}px ${F.mono}`,
    lifer: (px) => `600 ${px}px ${F.body}`,
    brand: (px) => `700 ${px}px ${F.display}`,
    footer: (px) => `400 ${px}px ${F.mono}`,
  }
}

/**
 * Everything a card needs before it is drawn: the layout, the pack fitted to the collage, the tiles and their sticker
 * URLs, the text, the fonts (loaded) and where the footer line goes. paintCard only draws it.
 */
export type PreparedCard = {
  format: CardFormat
  L: CardLayout
  colors: ShareColors
  fit: PackFit
  tiles: Tile[]
  /** The latest lifer's sticker, contained in its square, at its final y (moved up by `shift` with its row). */
  lifer: Tile | null
  /** The count as drawn: L.count grown with the birds when a short list is scaled up. */
  K: CountLayout
  footerLine: string
  latest?: { label: string; name: string }
  name?: string
  label?: string
  fonts: CardFonts
  /** The wordmark's width plus the gap before the footer line beside it. */
  brandW: number
  /** The footer line's size, and whether it took its own line under the wordmark (placeCredit). */
  credit: { size: number; below: boolean }
  /** How far the wordmark, the hairline and the latest lifer row move up when the footer line is below the wordmark. */
  shift: number
}
type CardDraft = Omit<PreparedCard, 'brandW' | 'credit' | 'shift'>

/** The card without its fonts and footer placement: layout, pack, fit, tiles, text. `scale`: device px per design unit. */
async function draftCard(opts: ShareImageOpts, scale: number): Promise<CardDraft> {
  const { format, entries, species, theme, signal } = opts
  const print = format === 'print'
  const colors: ShareColors = SHARE_COLORS[theme]
  const shown = entries.filter((e) => species.byCode.has(e.code))
  const latestE = latestLifer(shown, (c) => species.byCode.get(c)?.to ?? Number.MAX_SAFE_INTEGER)
  const latestRow = latestE && species.byCode.get(latestE.code)!
  const latest = opts.latest !== false && latestRow ? latestText({ com: latestRow.com, date: latestE!.date }) : undefined
  const label = opts.filterLabel?.trim() || undefined
  const name = opts.name?.trim() || undefined
  const footerLine = withStamp(FOOTER_LINE, stampDate(opts.now ?? new Date()))
  const content: CardContent = { name: !!name, filter: !!label, latest: !!latest, count: shown.length }
  const L = cardLayout(format, content, print ? printDesignH(opts.printSize ?? 'A4') : undefined)
  // Packed for the format's own frame (the print: at PRINT_DESIGN_H, one pack for every A size, as imagePackSpec).
  const pack = opts.pack ?? (await packForImage(shown, species, imagePackSpec(format, content), signal))
  if (signal?.aborted) throw abortError()

  // A tile's sticker: the share images' 128/384 by its size; the print's by its device px (1024 with the 384 fallback).
  const sticker = (code: string, side: number, sv?: string): Pick<Tile, 'url' | 'fallback'> =>
    print ? printStickerUrl(code, side * scale, sv) : { url: stickerUrl(code, side, 1, sv) }

  // The pack on the collage area, its centre (the count) on the area's centre.
  const area = L.collage
  const fit = fitPack(pack, area, maxTileSide(area.w, L.maxTile), SPREAD[format])
  const tiles: Tile[] = shown.flatMap((e) => {
    const b = pack.boxes.get(e.code)
    if (!b) return []
    const row = species.byCode.get(e.code)!
    const [w, h] = [b[2] * fit.s, b[3] * fit.s]
    const [x, y] = [fit.cx + (b[0] - fit.ux) * fit.s, spreadY(fit, b[1] + b[3] / 2) - h / 2]
    return [{ x, y, w, h, ...(row.st ? sticker(e.code, Math.max(w, h), row.sv) : { url: null }) }]
  })
  // The latest lifer's sticker, contained in its square at the sticker's own aspect.
  let lifer: Tile | null = null
  if (latestRow && L.latest) {
    const { icon, y } = L.latest
    const ar = latestRow.st && latestRow.ar > 0 ? latestRow.ar : 1
    const w = ar >= 1 ? icon : icon * ar, h = ar >= 1 ? icon / ar : icon
    lifer = { x: M + (icon - w) / 2, y: y + (icon - h) / 2, w, h, ...(latestRow.st ? sticker(latestRow.code, icon, latestRow.sv) : { url: null }) }
  }
  // The count grows with the birds when a short list is scaled up past the width fit (its hole grew as much).
  const g = Math.min(fit.grow, 1.3)
  const K = { ...L.count, size: Math.round(L.count.size * g), labelSize: Math.round(L.count.labelSize * Math.min(g, 1.15)), gap: Math.round(L.count.gap * g) }
  return { format, L, colors, fit, tiles, lifer, K, footerLine, latest, name, label, fonts: cardFonts() }
}

/**
 * A text measurer for the footer's placement: a scratch canvas's measureText (the same widths the card's own canvas
 * gets; measureText ignores the transform), else, without a DOM (Node tests), an estimate of `em` per character.
 * Throws when there is a DOM but no 2D canvas, as drawing would.
 */
function textMeasurer(): (font: string, px: number, text: string, em: number) => number {
  if (typeof document === 'undefined') return (_font, px, text, em) => text.length * em * px
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  return (font, _px, text) => { ctx.font = font; return ctx.measureText(text).width }
}

/** Wait (at most 3 s) for every font the card draws with. */
function cardFontsReady(d: CardDraft): Promise<void> {
  const { L, fonts: font, K, name, label, latest, footerLine } = d
  return fontsReady(
    [font.name(L.name?.size ?? 60), font.filter(34), font.count(K.size), font.mono(K.labelSize), font.lifer(34), font.brand(30), font.footer(20)],
    `${name ?? ''}${label ?? ''}${K.number}${K.label}${latest ? latest.label.toUpperCase() + latest.name : ''}Everybird${footerLine}`,
  )
}

/**
 * Place the footer line (and so the rows above it that move with it). Call it once the fonts have settled, and for a
 * share image once the stickers have too (the moment the card was measured before the split), so it measures the faces
 * the card is drawn with.
 */
function placeFooter(d: CardDraft): PreparedCard {
  const { L, fonts: font, footerLine } = d
  // Footer, quiet: the wordmark, then one line on its baseline, the site, the sticker credit and the date stamp ("… ·
  // stickers by huashu · 14 Nov 2026", never truncated). If it doesn't fit there at 17px or more, it takes its
  // own line under the wordmark at the bottom safe line, and the wordmark, the hairline and the latest lifer row move
  // up by that line. Estimates without a DOM: Cabinet Grotesk 700 about 0.55 em a character, Geist Mono 0.6.
  const maxW = L.W - 2 * M
  const measure = textMeasurer()
  const brandW = measure(font.brand(L.footer.size), L.footer.size, 'Everybird', 0.55) + 16
  const credit = placeCredit((px) => measure(font.footer(px), px, footerLine, 0.6), maxW - brandW, maxW, L.footer.credit)
  const shift = credit.below ? credit.size + 12 : 0
  const lifer = d.lifer && { ...d.lifer, y: d.lifer.y - shift }
  return { ...d, lifer, brandW, credit, shift }
}

/**
 * Everything drawShareImage computes before its canvas: the pack (made here when `opts.pack` is absent), the fit, the
 * tiles and their sticker URLs, the text, the fonts (awaited) and the footer's placement. `scale` is device px per
 * design unit; it only picks the print's sticker tier (printStickerUrl). Throws an AbortError when `opts.signal` aborts.
 */
export async function prepareCard(opts: ShareImageOpts, scale = 1): Promise<PreparedCard> {
  const draft = await draftCard(opts, scale)
  await cardFontsReady(draft)
  if (opts.signal?.aborted) throw abortError()
  return placeFooter(draft)
}

/** The unique sticker URLs a card draws (tiles, then the latest lifer), in that order. Fallbacks are not included. */
export function cardUrls(card: Pick<PreparedCard, 'tiles' | 'lifer'>): string[] {
  return [...new Set([...card.tiles, ...(card.lifer ? [card.lifer] : [])].flatMap((t) => (t.url ? [t.url] : [])))]
}

/**
 * Draw a prepared card in design units (0..L.W, 0..L.H) under whatever transform the caller set: identity for a share
 * image, `setTransform(k, 0, 0, k, 0, -y)` for a poster strip. It starts with Paper over the whole card. With `range`
 * (design y), tiles outside it (tileInRange) are skipped; text is always drawn (cheap, and the canvas clips it).
 */
export function paintCard(ctx: CanvasRenderingContext2D, card: PreparedCard, imgs: Map<string, CanvasImageSource | null>, range?: PaintRange): void {
  const { L, colors: C, fit, K, fonts: font, latest, name, label, lifer, footerLine, brandW, credit, shift } = card
  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, L.W, L.H)

  // The collage.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  paintTiles(ctx, card.tiles, imgs, C.line, range)

  const maxW = L.W - 2 * M
  const track = (em: number, px: number) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${(em * px).toFixed(2)}px` }

  // The count in the middle: the number (Cabinet Grotesk 700, -0.02em) over the mono label, centred as one block on
  // the collage's centre (the hole), measured from the digits' real height.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = font.count(K.size)
  track(-0.02, K.size)
  const digitH = ctx.measureText('0').actualBoundingBoxAscent || 0.6875 * K.size
  ctx.font = font.mono(K.labelSize)
  track(0.06, K.labelSize)
  const capH = ctx.measureText('S').actualBoundingBoxAscent || 0.73 * K.labelSize
  const blockTop = fit.cy - (digitH + K.gap + capH) / 2
  ctx.font = font.count(K.size)
  track(-0.02, K.size)
  ctx.fillStyle = C.ink
  ctx.fillText(K.number, fit.cx, blockTop + digitH)
  ctx.font = font.mono(K.labelSize)
  track(0.06, K.labelSize)
  ctx.fillStyle = C.muted
  ctx.fillText(K.label, fit.cx, blockTop + digitH + K.gap + capH)
  track(0, 0)

  // Text.
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  const draw = (str: string, f: (px: number) => string, t: Text, min: number, color: string, x = M, w = maxW) => {
    const out = fitText(ctx, str, f, t.size, min, w)
    ctx.fillStyle = color
    ctx.fillText(out, x, t.y)
  }
  if (name && L.name) draw(name, font.name, L.name, 36, C.ink)
  if (label && L.filter) draw(label, font.filter, L.filter, 24, C.accent)

  // The latest lifer: its sticker, then the mono label over the bird's name, centred on the sticker.
  if (latest && lifer && L.latest) {
    paintTiles(ctx, [lifer], imgs, C.line, range)
    const { icon } = L.latest
    const y = L.latest.y - shift
    const tx = M + icon + 20, tw = maxW - icon - 20
    const blockH = L.latest.label + 10 + L.latest.name
    const top = y + (icon - blockH) / 2
    track(0.06, L.latest.label)
    draw(latest.label.toUpperCase(), font.mono, { y: top, size: L.latest.label }, 16, C.muted, tx, tw)
    track(0, 0)
    draw(latest.name, font.lifer, { y: top + L.latest.label + 10, size: L.latest.name }, 24, C.ink, tx, tw)
  }

  // The footer (placed by prepareCard): the hairline, the wordmark, the line beside or under it.
  const base = L.footer.y + L.footer.size * 0.8
  ctx.fillStyle = C.hairline
  ctx.fillRect(M, L.rule.y - shift, maxW, 2)
  ctx.textBaseline = 'alphabetic'
  ctx.font = font.brand(L.footer.size)
  ctx.fillStyle = C.ink
  ctx.fillText('Everybird', M, base - shift)
  ctx.font = font.footer(credit.size)
  ctx.fillStyle = C.muted
  ctx.fillText(footerLine, credit.below ? M : M + brandW, base)
}

/**
 * Draw the share image on a new canvas (renderShareImage encodes it): prepare, load the stickers, paint. For the print
 * this is the 1080-wide preview (at scale 1 no tile passes 440 px, so it uses the 128/384 files).
 */
export async function drawShareImage(opts: ShareImageOpts): Promise<HTMLCanvasElement> {
  const { signal } = opts
  const draft = await draftCard(opts, 1)
  // The stickers load while the fonts do; the footer is measured once both have settled, as before the split.
  const [imgs] = await Promise.all([loadStickers(cardUrls(draft), { signal }), cardFontsReady(draft)])
  if (signal?.aborted) throw abortError()
  const card = placeFooter(draft)

  const canvas = document.createElement('canvas')
  canvas.width = card.L.W
  canvas.height = Math.round(card.L.H)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  // The print's height is fractional (A4 1527.7 rounds up to 1528): Paper over the whole canvas covers its last row.
  if (canvas.height > card.L.H) {
    ctx.fillStyle = card.colors.paper
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  paintCard(ctx, card, imgs)
  return canvas
}
