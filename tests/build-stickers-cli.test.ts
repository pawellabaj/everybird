import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterAll, expect, it } from 'vitest'
import { gitBlobSha } from '../scripts/build-data/huashu-pin'

const dirs: string[] = []
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }) })

it('print CLI builds selected shipped sources only, resumes, and never writes screen data or metadata', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'eb-print-cli-'))
  dirs.push(cwd)
  const put = (path: string, contents: string | Buffer) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true })
    writeFileSync(join(cwd, path), contents)
  }
  const source = readFileSync(resolve(__dirname, 'fixtures/build/sticker.png'))
  const rows = ['a', 'b', 'outline'].map((code) => ({ code, st: code !== 'outline', sv: 'version', ar: 0.5 }))
  put('public/data/species.v1.json', JSON.stringify({ species: rows }))
  put('public/data/masks/Test.v1.json', 'untouched masks')
  put('data/overrides.json', '{}')
  put('data/raw/manifest.json', JSON.stringify({ huashuCommit: 'pinned' }))
  put('data/huashu.lock.json', JSON.stringify({ commit: 'pinned', shipped: { a: gitBlobSha(source), b: gitBlobSha(source) } }))
  put('data/raw/ebird-taxonomy.json', JSON.stringify(rows.map(({ code }) => ({ speciesCode: code, sciName: `Avis ${code}`, category: 'species', taxonOrder: 1 }))))
  put('data/raw/huashu/data/species.json', JSON.stringify({ species: rows.map(({ code }) => ({ id: code, scientificName: `Avis ${code}`, ids: { ebird: code }, taxonomy: { seq: 1 }, sticker: { file: `${code}.png` } })) }))
  for (const { code } of rows) put(`data/raw/huashu/${code}.png`, source)
  put('out/README.md', 'untouched README')
  put('out/LICENSE', 'untouched LICENSE')
  const run = (...args: string[]) => execFileSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), resolve('scripts/build-data/build-stickers.ts'), '--tier', '1024', '--codes', 'a,outline', ...args], { cwd, env: { ...process.env, STICKERS_OUT: join(cwd, 'out') }, encoding: 'utf8', stdio: 'pipe' })
  expect(run()).toContain('1 built, 0 reused')
  expect(readdirSync(join(cwd, 'out/v1/1024'))).toEqual(['a.version.webp'])
  expect(existsSync(join(cwd, 'out/v1/128'))).toBe(false)
  expect(existsSync(join(cwd, 'out/v1/384'))).toBe(false)
  put('out/v1/1024/a.version.webp', 'existing bytes')
  expect(run()).toContain('0 built, 1 reused')
  expect(readFileSync(join(cwd, 'out/v1/1024/a.version.webp'), 'utf8')).toBe('existing bytes')
  expect(run('--force')).toContain('1 built, 0 reused')
  expect(JSON.parse(readFileSync(join(cwd, 'public/data/species.v1.json'), 'utf8')).species).toEqual(rows)
  for (const [path, expected] of [['public/data/masks/Test.v1.json', 'untouched masks'], ['out/README.md', 'untouched README'], ['out/LICENSE', 'untouched LICENSE']]) expect(readFileSync(join(cwd, path), 'utf8')).toBe(expected)
  // A skipped file still has its source checked against the shipped blob.
  put('data/huashu.lock.json', JSON.stringify({ commit: 'pinned', shipped: { a: 'wrong' } }))
  expect(() => run()).toThrow(/published sticker was built/)
  put('data/raw/manifest.json', JSON.stringify({ huashuCommit: 'wrong' }))
  expect(() => run()).toThrow(/pins pinned/)
}, 30_000)
