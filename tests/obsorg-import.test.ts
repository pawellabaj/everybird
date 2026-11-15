import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleParseMessage, type ParseResponse } from '@/lib/import/parse.worker'
import { parseInWorker } from '@/lib/import/parse-client'
import { fixture, regions, taxonomy as t } from './obsorg-helpers'
const file = (kind = 'species-observed-nl') => new File([fixture(kind)], 'synthetic.csv')

describe('observation.org worker dispatch', () => {
  it('parses a species list with the supplied synonyms', async () => {
    const posts: ParseResponse[] = []
    await handleParseMessage({kind:'obsorg-species', file:file(), synonyms:{ 'Avis inventa':'gilfli' }}, m => posts.push(m), async () => t)
    expect(posts.at(-1)).toMatchObject({type:'done',result:{rows:15}})
    const done = posts.at(-1) as Extract<ParseResponse,{type:'done'}>
    expect(done.result.records).toHaveLength(7)
  })
  it('reports no-birds as an error', async () => {
    const posts: ParseResponse[] = []
    await handleParseMessage({kind:'obsorg-species',file:new File([''],'empty.csv'),synonyms:{}},m => posts.push(m),async () => t)
    expect(posts).toEqual([{type:'error',message:'no-birds'}])
  })
  it('parses observations with supplied regions and preserves exclusion details', async () => {
    const posts: ParseResponse[] = []
    await handleParseMessage({kind:'obsorg-observations',file:file('observations-nl'),synonyms:{},regions},m => posts.push(m),async () => t)
    const done = posts.at(-1) as Extract<ParseResponse,{type:'done'}>
    expect(done).toMatchObject({type:'done',result:{excluded:{escape:1,uncertain:1}}})
    expect(done.result.records.find(x => x.code === 'norfli')?.place).toEqual({country:'BE',sub1:'BE-VAN'})
  })
  it('refuses observations without regions rather than losing every place', async () => {
    const posts: ParseResponse[] = []
    await handleParseMessage({kind:'obsorg-observations',file:file('observations-nl'),synonyms:{}} as never,m => posts.push(m),async () => t)
    expect(posts.at(-1)).toEqual({type:'error',message:'observation.org regions are required.'})
  })
  it('refuses observation.org files without the synonyms', async () => {
    for (const kind of ['obsorg-species','obsorg-observations'] as const) {
      const posts: ParseResponse[] = []
      await handleParseMessage({kind,file:file(),regions} as never,m => posts.push(m),async () => t)
      expect(posts.at(-1)).toEqual({type:'error',message:'observation.org synonyms are required.'})
    }
  })
})

describe('parse client', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('forwards synonyms and regions, returns excluded counts, and terminates the worker', async () => {
    const postMessage = vi.fn(), terminate = vi.fn()
    const instances: FakeWorker[] = []
    class FakeWorker {
      onmessage?: (e:{data:ParseResponse}) => void
      postMessage = postMessage
      terminate = terminate
      constructor() { instances.push(this) }
    }
    vi.stubGlobal('Worker', FakeWorker)
    const clientRegions = {v:1 as const,countries:{NL:'Netherlands'},sub1:{'NL-NH':'North Holland'}}
    const f = file('observations-nl'), synonyms = { 'Avis inventa':'gilfli' }
    const progress = vi.fn()
    const result = parseInWorker('obsorg-observations',f,{onProgress:progress,synonyms,regions:clientRegions})
    expect(postMessage).toHaveBeenCalledWith({kind:'obsorg-observations',file:f,synonyms,regions:clientRegions})
    instances[0].onmessage!({data:{type:'progress',rows:5000}})
    const parsed = {records:[],unmatched:[],skipped:0,excluded:{escape:1,uncertain:1}}
    instances[0].onmessage!({data:{type:'done',result:parsed}})
    expect(await result).toEqual(parsed)
    expect(progress).toHaveBeenCalledWith(5000)
    expect(terminate).toHaveBeenCalledOnce()
  })
})
