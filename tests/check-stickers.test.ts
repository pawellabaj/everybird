import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import sharp from 'sharp'
import { checkStickers } from '../scripts/build-data/check-stickers'

it('1024 is optional, print checks missing files, and corrupt print files fail decoding', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'eb-print-check-'))
  const webp = await sharp({ create: { width: 4, height: 4, channels: 4, background: 'red' } }).webp().toBuffer()
  for (const size of [128, 384, 1024]) mkdirSync(join(dir, 'v1', String(size)), { recursive: true })
  for (const rel of ['128/a.webp', '384/a.webp', '128/b.webp', '384/b.webp', '1024/a.webp']) writeFileSync(join(dir, 'v1', rel), webp)
  expect(await checkStickers(dir)).toMatchObject({ checked: 5, missing: [], failed: [] })
  expect((await checkStickers(dir, 4, { print: true })).missing).toEqual(['b'])
  writeFileSync(join(dir, 'v1/1024/a.webp'), 'corrupt')
  expect((await checkStickers(dir)).failed.map((f) => f.file)).toEqual(['1024/a.webp'])
})
it('requires both small tiers even without a print directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'eb-print-pair-'))
  for (const size of [128, 384]) mkdirSync(join(dir, 'v1', String(size)), { recursive: true })
  writeFileSync(join(dir, 'v1/384/a.webp'), await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).webp().toBuffer())
  expect((await checkStickers(dir)).missing).toEqual(['a'])
})
