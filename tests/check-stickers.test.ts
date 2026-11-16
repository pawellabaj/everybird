import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it } from 'vitest'
import sharp from 'sharp'
import { checkStickers, rebuildHints } from '../scripts/build-data/check-stickers'

const dirs: string[] = []
const tmp = (prefix: string) => { const d = mkdtempSync(join(tmpdir(), prefix)); dirs.push(d); return d }
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }) })
const webp = () => sharp({ create: { width: 4, height: 4, channels: 4, background: 'red' } }).webp().toBuffer()
async function root(files: string[], sizes = [128, 384, 1024]) {
  const dir = tmp('eb-print-check-')
  for (const size of sizes) mkdirSync(join(dir, 'v1', String(size)), { recursive: true })
  const bytes = await webp()
  for (const rel of files) writeFileSync(join(dir, 'v1', rel), bytes)
  return dir
}

it('1024 is optional, print checks the species rows, and corrupt print files fail decoding', async () => {
  const dir = await root(['128/a.webp', '384/a.webp', '128/b.webp', '384/b.webp', '1024/a.webp'])
  expect(await checkStickers(dir)).toMatchObject({ checked: 5, missing: [], printMissing: [], failed: [] })
  const rows = [{ code: 'a', st: true }, { code: 'b', st: true }, { code: 'gone', st: false }]
  expect(await checkStickers(dir, 4, { print: rows })).toMatchObject({ missing: [], printMissing: ['b'] })
  writeFileSync(join(dir, 'v1/1024/a.webp'), 'corrupt')
  expect((await checkStickers(dir)).failed.map((f) => f.file)).toEqual(['1024/a.webp'])
})

it('requires both small tiers even without a print directory', async () => {
  const dir = await root(['384/a.webp'], [128, 384])
  expect((await checkStickers(dir)).missing).toEqual(['a'])
})

it('fails when a screen tier directory is missing, or the root does not exist', async () => {
  await expect(checkStickers(await root(['1024/a.webp'], [1024]))).rejects.toThrow(/v1\/128/)
  await expect(checkStickers(await root(['128/a.webp'], [128]))).rejects.toThrow(/v1\/384/)
  await expect(checkStickers(join(tmp('eb-print-none-'), 'nope'))).rejects.toThrow(/not a stickers checkout/)
})

it('print mode expects only the current version: a superseded file on disk is not missing a print file', async () => {
  // c was redrawn: its plain v1 files and its old version stay on disk; only the current sv needs a 1024 file.
  const dir = await root(['128/c.webp', '384/c.webp', '128/c.old.webp', '384/c.old.webp', '128/c.new.webp', '384/c.new.webp', '1024/c.new.webp'])
  expect(await checkStickers(dir, 4, { print: [{ code: 'c', st: true, sv: 'new' }] })).toMatchObject({ missing: [], printMissing: [], failed: [] })
  expect((await checkStickers(dir, 4, { print: [{ code: 'c', st: true, sv: 'newer' }] })).printMissing).toEqual(['c'])
})

it('rebuild hints give bare codes, the print ones with --tier 1024', () => {
  expect(rebuildHints({ checked: 0, failed: [], missing: [], printMissing: [] })).toEqual([])
  expect(rebuildHints({
    checked: 6,
    failed: [{ file: '128/a.abc.webp', error: 'x' }, { file: '384/b.webp', error: 'x' }, { file: '1024/d.def.webp', error: 'x' }],
    missing: ['c.0123456789', 'a.abc'],
    printMissing: ['e'],
  })).toEqual([
    'npx tsx scripts/build-data/build-stickers.ts --codes a,b,c',
    'npx tsx scripts/build-data/build-stickers.ts --tier 1024 --codes d,e',
  ])
})
