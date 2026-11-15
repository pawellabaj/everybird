// Downloads the raw sources into data/raw/ (git-ignored) and writes data/raw/manifest.json.
// Run: npx tsx scripts/build-data/fetch-sources.ts [--huashu-only | --names-only] [--taxonomy <YYYY|latest>]
// The eBird taxonomy year is public/data/species.v1.json's, else data/raw/manifest.json's; --taxonomy picks another
// (the yearly upgrade: fetch with --taxonomy latest, then npm run data). --names-only overwrites
// data/raw/ebird-taxonomy.json too, so names and species always read the same year.
// huashu-bird-sticker is checked out at the commit data/huashu.lock.json pins (the state the committed data was synced
// to; see scripts/sync/huashu-sync.ts), or at upstream HEAD when there is no lock. --huashu-only moves data/raw/huashu
// to the pinned commit and updates the manifest's huashu entries, leaving the other downloads as they are (what
// build-species and build-stickers ask for after a huashu sync PR is merged).
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { NAME_LOCALES } from '../../src/lib/species/name-locales'
import type { NameLocale } from '../../src/lib/species/name-locales'

const RAW = resolve(process.cwd(), 'data/raw')
const HUASHU_URL = 'https://github.com/alchaincyf/huashu-bird-sticker'
const EBIRD_URL = 'https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json'
const EBIRD_VERSIONS_URL = 'https://api.ebird.org/v2/ref/taxonomy/versions'
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'

const ISO_URL = 'https://salsa.debian.org/iso-codes-team/iso-codes/-/raw/main/data/iso_3166-2.json'

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex')

/** Writes the download to data/raw/<file> and returns its sha256, recorded in the manifest. */
async function download(url: string, file: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(resolve(RAW, file), buf)
  console.log(`${file}: ${(buf.length / 1e6).toFixed(1)} MB`)
  return sha256(buf)
}

/** Use the same taxonomy year as English, including when the API's latest year changes. */
export function taxonomyUrl(version: string, locale?: NameLocale): string {
  const url = new URL(EBIRD_URL)
  if (locale) {
    url.searchParams.set('cat', 'species')
    url.searchParams.set('locale', locale === 'nl' ? 'nl_NL' : locale)
  }
  url.searchParams.set('version', version)
  return url.href
}

type CodeRow = { speciesCode: string; category?: string }
export function assertSameSpeciesCodes(english: CodeRow[], localized: CodeRow[], locale: string): void {
  const codes = english.filter((r) => r.category === 'species').map((r) => r.speciesCode)
  const expected = new Set(codes)
  const actual = new Set(localized.map((r) => r.speciesCode))
  if (!expected.size || expected.size !== codes.length || actual.size !== localized.length ||
      expected.size !== actual.size || [...expected].some((code) => !actual.has(code))) {
    throw new Error(`${locale}: species codes differ from the pinned English taxonomy`)
  }
}

type Source = { name: string; url: string; date: string; version?: string; sha256?: string }
async function fetchNames(version: string): Promise<Source[]> {
  const english = JSON.parse(readFileSync(resolve(RAW, 'ebird-taxonomy.json'), 'utf8')) as CodeRow[]
  const sources: Source[] = []
  const date = new Date().toISOString().slice(0, 10)
  for (const locale of NAME_LOCALES) {
    const url = taxonomyUrl(version, locale)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
    const rows = await res.json() as CodeRow[]
    assertSameSpeciesCodes(english, rows, locale)
    const file = `ebird-taxonomy.${locale}`
    const body = JSON.stringify(rows)
    writeFileSync(resolve(RAW, `${file}.json`), body)
    sources.push({ name: file, url, date, version, sha256: sha256(body) })
    console.log(`${file}: ${rows.length} species`)
  }
  // English groups supply the exact famCom matching key, joined by groupOrder in build-names.
  // sppgroup has no version: the endpoint ignores `version=` (checked 2026-11-15: 2026, 2019 and 1900 all return the
  // same bytes), so these are today's groups; the sha256 records exactly which ones a build used.
  for (const [lang, locale] of [['en', 'en'], ['es', 'es'], ['pt', 'pt_BR'], ['nl', 'nl']] as const) {
    const url = `https://api.ebird.org/v2/ref/sppgroup/ebird?groupNameLocale=${locale}`
    const file = `ebird-groups.${lang}`
    sources.push({ name: file, url, date, sha256: await download(url, `${file}.json`) })
  }
  return sources
}

/** `--taxonomy <YYYY|latest>` from argv, or undefined. */
export function taxonomyFlag(argv: string[]): string | undefined {
  const i = argv.indexOf('--taxonomy')
  if (i < 0) return undefined
  const value = argv[i + 1]
  if (!value || !/^(\d{4}|latest)$/.test(value)) throw new Error('--taxonomy takes a year (YYYY) or latest')
  return value
}

/**
 * The eBird taxonomy year to fetch: the --taxonomy flag, else the committed public/data/species.v1.json's year (what
 * the published data was built from), else data/raw/manifest.json's. Never silently latest: `latest` must be asked for.
 */
export async function pinnedTaxonomy(flag: string | undefined, root = process.cwd(), fetchImpl: typeof fetch = fetch): Promise<string> {
  if (flag && flag !== 'latest') return flag
  if (!flag) {
    for (const file of [resolve(root, 'public/data/species.v1.json'), resolve(root, 'data/raw/manifest.json')]) {
      if (existsSync(file)) {
        const version = JSON.parse(readFileSync(file, 'utf8')).ebirdTaxonomy
        if (typeof version === 'string' && /^\d{4}$/.test(version)) return version
      }
    }
    throw new Error('No pinned eBird taxonomy year (species.v1.json or data/raw/manifest.json): pass --taxonomy <YYYY|latest>')
  }
  const res = await fetchImpl(EBIRD_VERSIONS_URL)
  if (!res.ok) throw new Error(`eBird taxonomy versions -> HTTP ${res.status}`)
  const versions = await res.json() as { authorityVer: number; latest: boolean }[]
  const version = versions.find((v) => v.latest)?.authorityVer
  if (!version) throw new Error('No eBird taxonomy version available')
  return String(version)
}

/** Clones huashu (depth 1) if needed and checks out `commit` (fetching just that commit), or keeps HEAD. */
export function checkoutHuashu(dir: string, commit?: string): string {
  const git = (...args: string[]) => execFileSync('git', ['-C', dir, ...args], { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim()
  if (!existsSync(dir)) execFileSync('git', ['clone', '--depth', '1', HUASHU_URL, dir], { stdio: 'inherit' })
  if (commit && git('rev-parse', 'HEAD') !== commit) {
    git('fetch', '--depth', '1', 'origin', commit)
    git('checkout', '--quiet', '--detach', commit)
  }
  return git('rev-parse', 'HEAD')
}

function lockedCommit(): string | undefined {
  const p = resolve(process.cwd(), 'data/huashu.lock.json')
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as { commit: string }).commit : undefined
}

async function main() {
  mkdirSync(RAW, { recursive: true })
  if (process.argv.includes('--names-only')) {
    const ebirdTaxonomy = await pinnedTaxonomy(taxonomyFlag(process.argv))
    const url = taxonomyUrl(ebirdTaxonomy)
    const taxonomySha = await download(url, 'ebird-taxonomy.json')
    const sources = await fetchNames(ebirdTaxonomy)
    const path = resolve(RAW, 'manifest.json')
    const manifest = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
    const date = new Date().toISOString().slice(0, 10)
    const additions = [{ name: 'ebird-taxonomy', url, date, version: ebirdTaxonomy, sha256: taxonomySha }, ...sources]
    const replaced = new Set(additions.map((s) => s.name))
    manifest.ebirdTaxonomy = ebirdTaxonomy
    manifest.sources = [...(manifest.sources ?? []).filter((s: Source) => !replaced.has(s.name)), ...additions]
    writeFileSync(path, JSON.stringify(manifest, null, 2))
    console.log('names sources written; eBird taxonomy', ebirdTaxonomy)
    return
  }
  const huashuDir = resolve(RAW, 'huashu')
  const huashuCommit = checkoutHuashu(huashuDir, lockedCommit())

  if (process.argv.includes('--huashu-only')) {
    const path = resolve(RAW, 'manifest.json')
    if (!existsSync(path)) throw new Error('no data/raw/manifest.json yet: run fetch-sources.ts without --huashu-only first')
    const m = JSON.parse(readFileSync(path, 'utf8'))
    m.huashuCommit = huashuCommit
    for (const src of m.sources ?? []) if (src.name === 'huashu-bird-sticker') src.commit = huashuCommit
    writeFileSync(path, JSON.stringify(m, null, 2))
    console.log('data/raw/huashu at', huashuCommit)
    return
  }

  const ebirdTaxonomy = await pinnedTaxonomy(taxonomyFlag(process.argv))
  const ebirdUrl = taxonomyUrl(ebirdTaxonomy)

  const taxonomySha = await download(ebirdUrl, 'ebird-taxonomy.json')
  const namesSources = await fetchNames(ebirdTaxonomy)
  const ne0Sha = await download(NE + 'ne_50m_admin_0_countries.geojson', 'ne_50m_admin_0_countries.geojson')
  const ne1Sha = await download(NE + 'ne_10m_admin_1_states_provinces.geojson', 'ne_10m_admin_1_states_provinces.geojson')
  const isoSha = await download(ISO_URL, 'iso_3166-2.json')

  const date = new Date().toISOString().slice(0, 10)
  const manifest = {
    date,
    huashuCommit,
    ebirdTaxonomy,
    sources: [
      { name: 'huashu-bird-sticker', url: HUASHU_URL, date, commit: huashuCommit },
      { name: 'ebird-taxonomy', url: ebirdUrl, date, version: ebirdTaxonomy, sha256: taxonomySha },
      ...namesSources,
      { name: 'ne_50m_admin_0_countries', url: NE + 'ne_50m_admin_0_countries.geojson', date, sha256: ne0Sha },
      { name: 'ne_10m_admin_1_states_provinces', url: NE + 'ne_10m_admin_1_states_provinces.geojson', date, sha256: ne1Sha },
      { name: 'iso-codes iso_3166-2 (Debian iso-codes, LGPL-2.1)', url: ISO_URL, date, licence: 'LGPL-2.1', sha256: isoSha },
    ],
  }
  writeFileSync(resolve(RAW, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('manifest written; huashu', huashuCommit, 'eBird taxonomy', ebirdTaxonomy)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
