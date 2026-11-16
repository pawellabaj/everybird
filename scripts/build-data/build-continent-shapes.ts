// Writes src/lib/places/continent-shapes.ts: one line-drawn globe per continent for the Places drill's continent rows.
// Each continent's land (the countries CONTINENT_OF puts in it, Russia split at 60°E and Chukotka with Asia; Natural
// Earth's CONTINENT for codes the table lacks) is drawn as its coastlines in an orthographic view centred on the
// continent (CENTRES below; Antarctica seen from the south pole, so the pole faces the reader). The land is rasterised
// on a 2-unit grid of the 256 viewBox, its boundary traced, the small islands dropped and the outline simplified to a byte
// budget. The component draws the circle (cx 128, cy 128, r 112, stroke-width 16); the module gives the land paths only,
// whole numbers in the 256 viewBox, projected at scale 112 and translated to [128, 128].
// Source: data/raw/ne_50m_admin_0_countries.geojson (Natural Earth 1:50m, public domain; About's credits name Natural Earth).
// Run: npx tsx scripts/build-data/build-continent-shapes.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { geoOrthographic } from 'd3-geo'
import { CONTINENTS, CONTINENT_OF, type ContinentId } from '../../src/lib/places/continents'

const ROOT = resolve(__dirname, '../..')
const SRC = resolve(ROOT, 'data/raw/ne_50m_admin_0_countries.geojson')
const OUT = resolve(ROOT, 'src/lib/places/continent-shapes.ts')

/** The view's centre per continent, [longitude, latitude] in degrees. */
const CENTRES: Record<ContinentId, [number, number]> = {
  AF: [18, 2],
  AS: [95, 40],
  EU: [15, 52],
  NA: [-100, 45],
  SA: [-60, -15],
  OC: [140, -25],
  AN: [0, -90],
}

const VIEW = 256
const RADIUS = 112
const CENTRE = 128
const CELL = 2 // raster cell, in viewBox units (128 × 128 cells)
const N = VIEW / CELL
const BUDGET = 1200 // bytes of path data per continent (the brief: under 1.5 KB; the module under 10 KB)
const MIN_AREA = 78 // loops enclosing less than this (viewBox units²) are islands and are dropped: about 0.05% of the sphere
const FINEST = 6 // the finest simplification (viewBox units, about half a display pixel at 18px): hard simplification
const RU_SPLIT = 60 // Russia: the part west of 60°E is Europe, the rest Asia (Chukotka, east of -170°, is Asia too)
const RU_EAST = -170

const NE_NAME: Record<string, ContinentId> = {
  Africa: 'AF',
  Asia: 'AS',
  Europe: 'EU',
  'North America': 'NA',
  'South America': 'SA',
  Oceania: 'OC',
  Antarctica: 'AN',
}

type Pt = [number, number]
interface Ring {
  pts: Pt[]
  minX: number
  maxX: number
  minY: number
  maxY: number
}
interface Country {
  iso: string
  cont: ContinentId | undefined
  rings: Ring[]
}

function ringOf(pts: Pt[], unwrapIt: boolean): Ring {
  let p = pts
  if (unwrapIt) {
    const xs = pts.map((q) => q[0])
    if (Math.max(...xs) - Math.min(...xs) > 180) p = pts.map(([x, y]): Pt => [x < 0 ? x + 360 : x, y])
  }
  const xs = p.map((q) => q[0])
  const ys = p.map((q) => q[1])
  return { pts: p, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

function loadCountries(): Country[] {
  const gj = JSON.parse(readFileSync(SRC, 'utf8')) as {
    features: { properties: Record<string, string>; geometry: { type: string; coordinates: Pt[][] | Pt[][][] } }[]
  }
  const out: Country[] = []
  for (const f of gj.features) {
    const p = f.properties
    const iso = p.ISO_A2 && p.ISO_A2 !== '-99' ? p.ISO_A2 : ''
    const cont = CONTINENT_OF[iso] ?? NE_NAME[p.CONTINENT]
    const polys: Pt[][][] =
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates as Pt[][]] : f.geometry.type === 'MultiPolygon' ? (f.geometry.coordinates as Pt[][][]) : []
    const rings = polys.map((poly) => {
      // Outer rings only: interior rings are enclaves and lakes, and the land is what the outer rings enclose.
      const outer = (poly[0] as Pt[]).slice(0, -1)
      return ringOf(outer, cont !== 'AN')
    })
    out.push({ iso, cont, rings })
  }
  return out
}

/** Even-odd test on a ring; the point may sit a turn east of the ring (the ring is unwrapped to 0..360). */
function inRing(r: Ring, x: number, y: number): boolean {
  if (x < r.minX || x > r.maxX || y < r.minY || y > r.maxY) return false
  let inside = false
  const p = r.pts
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i]
    const [xj, yj] = p[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inCountry(c: Country, lon: number, lat: number): boolean {
  for (const r of c.rings) {
    if (inRing(r, lon, lat)) return true
    if (lon < 0 && inRing(r, lon + 360, lat)) return true
  }
  return false
}

/** Which continent a point of a country belongs to: Russia by longitude, the rest by the country. */
function ownerAt(c: Country, lon: number): ContinentId | undefined {
  if (c.iso === 'RU') return lon >= RU_EAST && lon < RU_SPLIT ? 'EU' : 'AS'
  return c.cont
}

/** The centre's projection: the centre lands on the middle of the globe. */
function projection(centre: [number, number]) {
  return geoOrthographic()
    .rotate([-centre[0], -centre[1]])
    .scale(RADIUS)
    .translate([CENTRE, CENTRE])
    .clipAngle(90)
}

interface Edge {
  from: Pt
  to: Pt
  used: boolean
}

/** Traces the outline of the land mask: one loop per boundary, land kept on one side (corners in cell units). */
function traceLoops(mask: boolean[][]): Pt[][] {
  const out = new Map<string, Edge[]>()
  const key = (p: Pt) => `${p[0]},${p[1]}`
  const add = (from: Pt, to: Pt) => {
    const k = key(from)
    const list = out.get(k) ?? []
    list.push({ from, to, used: false })
    out.set(k, list)
  }
  const land = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N && mask[j][i]
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (!mask[j][i]) continue
      if (!land(i, j - 1)) add([i, j], [i + 1, j])
      if (!land(i + 1, j)) add([i + 1, j], [i + 1, j + 1])
      if (!land(i, j + 1)) add([i + 1, j + 1], [i, j + 1])
      if (!land(i - 1, j)) add([i, j + 1], [i, j])
    }
  }
  const loops: Pt[][] = []
  for (const list of out.values()) {
    for (const e0 of list) {
      if (e0.used) continue
      const loop: Pt[] = []
      let cur: Edge | undefined = e0
      while (cur && !cur.used) {
        cur.used = true
        loop.push(cur.from)
        const next: Edge | undefined = (out.get(key(cur.to)) ?? []).find((e) => !e.used)
        cur = next
      }
      if (loop.length >= 3) loops.push(loop)
    }
  }
  return loops
}

function area(pts: Pt[]): number {
  let a = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  return Math.abs(a) / 2
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

function dpOpen(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts
  let maxD = 0
  let idx = 0
  const a = pts[0]
  const b = pts[pts.length - 1]
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], a, b)
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD <= eps) return [a, b]
  const left = dpOpen(pts.slice(0, idx + 1), eps)
  const right = dpOpen(pts.slice(idx), eps)
  return [...left.slice(0, -1), ...right]
}

/** Douglas-Peucker on a closed loop: split at the point farthest from the first one. */
function dpClosed(loop: Pt[], eps: number): Pt[] {
  if (loop.length <= 3) return loop
  let far = 1
  let best = -1
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1])
    if (d > best) {
      best = d
      far = i
    }
  }
  const a = dpOpen([...loop.slice(0, far + 1)], eps)
  const b = dpOpen([...loop.slice(far), loop[0]], eps)
  return [...a.slice(0, -1), ...b.slice(0, -1)]
}

function pathOf(loops: Pt[][], eps: number): string {
  return loops
    .map((loop) => {
      const s: Pt[] = []
      for (const [x, y] of dpClosed(loop, eps)) {
        const p: Pt = [Math.round(x), Math.round(y)]
        const last = s[s.length - 1]
        if (!last || last[0] !== p[0] || last[1] !== p[1]) s.push(p)
      }
      if (s.length > 1 && s[0][0] === s[s.length - 1][0] && s[0][1] === s[s.length - 1][1]) s.pop()
      if (s.length < 3) return ''
      return `M${s.map(([x, y]) => `${x} ${y}`).join(' ')}Z`
    })
    .join('')
}

/** The coarsest-to-finest search: the finest simplification that fits the budget, dropping the smallest loops if none does. */
function fit(loops: Pt[][]): { d: string; eps: number; kept: number } {
  let set = [...loops].sort((a, b) => area(b) - area(a))
  for (;;) {
    if (set.length === 0) throw new Error('no loop fits the budget')
    if (pathOf(set, 40).length <= BUDGET) {
      if (pathOf(set, FINEST).length <= BUDGET) return { d: pathOf(set, FINEST), eps: FINEST, kept: set.length }
      let lo = FINEST
      let hi = 40
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2
        if (pathOf(set, mid).length <= BUDGET) hi = mid
        else lo = mid
      }
      return { d: pathOf(set, hi), eps: hi, kept: set.length }
    }
    set = set.slice(0, -1)
  }
}

function main() {
  const countries = loadCountries()
  const paths = {} as Record<ContinentId, string>
  const report: string[] = []

  for (const { id } of CONTINENTS) {
    const proj = projection(CENTRES[id])
    const mine = countries.filter((c) => c.cont === id || (c.iso === 'RU' && (id === 'EU' || id === 'AS')))
    const mask: boolean[][] = []
    for (let j = 0; j < N; j++) {
      const row: boolean[] = []
      for (let i = 0; i < N; i++) {
        const ll = proj.invert?.([i * CELL + CELL / 2, j * CELL + CELL / 2])
        let on = false
        if (ll) {
          let lon = ll[0]
          while (lon >= 180) lon -= 360
          while (lon < -180) lon += 360
          const lat = ll[1]
          on = mine.some((c) => ownerAt(c, lon) === id && inCountry(c, lon, lat))
        }
        row.push(on)
      }
      mask.push(row)
    }
    // Trace in cell units, then scale to viewBox units.
    const raw = traceLoops(mask).map((loop) => loop.map(([x, y]): Pt => [x * CELL, y * CELL]))
    const big = raw.filter((loop) => area(loop) >= MIN_AREA)
    const { d, eps, kept } = fit(big)
    paths[id] = d
    report.push(`${id}: ${d.length} bytes, ${kept} loops of ${raw.length} traced, eps ${eps.toFixed(2)}`)
  }

  for (const id of CONTINENTS.map((c) => c.id)) {
    if (!paths[id]) throw new Error(`empty globe for ${id}`)
  }

  const body = CONTINENTS.map(({ id }) => `  ${id}: '${paths[id]}',`).join('\n')
  const centres = CONTINENTS.map(({ id }) => `${id} ${CENTRES[id][0]},${CENTRES[id][1]}`).join(', ')
  const out = [
    '// Continent globes for the Places drill\'s continent rows: the coastlines of each continent in an orthographic view',
    '// centred on it (Antarctica from the south pole). GENERATED by scripts/build-data/build-continent-shapes.ts from',
    '// data/raw/ne_50m_admin_0_countries.geojson (Natural Earth 1:50m countries, public domain; About credits Natural Earth).',
    `// Centres (longitude,latitude): ${centres}. Do not edit: rerun the script.`,
    '// The component draws the circle (cx 128, cy 128, r 112, stroke-width 16); each path is the land only, no fill.',
    '',
    "import type { ContinentId } from './continents'",
    '',
    "export const CONTINENT_VIEWBOX = '0 0 256 256'",
    '',
    '/** One path per continent: its coastlines, whole numbers in the 256 viewBox. */',
    'export const CONTINENT_GLOBES: Record<ContinentId, string> = {',
    body,
    '}',
    '',
  ].join('\n')
  writeFileSync(OUT, out)
  console.log(report.join('\n'))
  console.log(`module: ${Buffer.byteLength(out)} bytes -> ${OUT}`)
}

main()
