// The landing sample, packed ahead of time (public/data/sample-pack.v1.json, scripts/build-data/build-sample-pack.ts):
// the sample list, the species rows and region names it uses, and its full even-mode collage for each layout class.
// The landing renders it straight away, without the 2.4 MB species file or the layout worker's mask downloads, so
// stickers appear fast on a slow link; the worker takes over (with the same layout) for filters and True size.
import type { LayoutName } from '@/lib/layout/layout.worker'
import type { StateLayout } from '@/lib/layout/layout-client'
import type { Box } from '@/lib/layout/pack'
import { buildSpeciesIndex, loadGroupMap, type SpeciesIndex } from '@/lib/species/load'
import type { NameBase } from '@/lib/species/name-locales'
import type { NameSet } from '@/lib/species/names'
import type { Regions, SpeciesRow } from '@/lib/species/types'
import { sampleToSaved, type SampleFile } from './sample'
import type { Saved } from './storage'
import { fetchData } from '../data-url'

export type PackedLayout = { layout: LayoutName; W: number; H: number; base: number; codes: string[]; boxes: number[] }
/** The sample's own names per base language (es, pt_BR, nl; never a regional set), so its birds read in the UI language
 *  before the names file arrives: only the sample's codes and their families, taken from public/data/names.<base>.v1.json. */
export type PackNames = Record<NameBase, Pick<NameSet, 'names' | 'fam'>>
export type SamplePackFile = SampleFile & { species: SpeciesRow[]; regions: Regions; layouts: PackedLayout[]; loc: PackNames }
export type SamplePack = { saved: Saved; species: SpeciesIndex; regions: Regions; seed: StateLayout[]; loc: PackNames }

/** The pack's layouts as the layout client's full collages (key "<layout>|even|", scale 1). */
export function seedLayouts(f: Pick<SamplePackFile, 'layouts'>): StateLayout[] {
  return f.layouts.map((l) => {
    const boxes = new Map<string, Box>()
    l.codes.forEach((c, i) => boxes.set(c, [l.boxes[4 * i], l.boxes[4 * i + 1], l.boxes[4 * i + 2], l.boxes[4 * i + 3]]))
    return { key: `${l.layout}|even|`, layout: l.layout, mode: 'even', W: l.W, H: l.H, boxes, scale: 1, base: l.base }
  })
}

/** `groups`: eBird's groups (the search's group chip and the Filter.group bounds); the sample's index has none without them. */
export function fromPackFile(f: SamplePackFile, groups?: SpeciesIndex['groups']): SamplePack {
  const index = buildSpeciesIndex(f.species)
  return { saved: sampleToSaved(f), species: groups ? { ...index, groups } : index, regions: f.regions, seed: seedLayouts(f), loc: f.loc }
}

let packP: Promise<SamplePack> | null = null

/** The landing sample, fetched once (a failure is not cached). */
export function loadSamplePack(): Promise<SamplePack> {
  if (packP) return packP
  const p = (async () => {
    // The small, shared groups file rides along; without it the sample's search just offers no group chip.
    const [file, groups] = await Promise.all([fetchData<SamplePackFile>('sample-pack.v1.json', { priority: 'high' } as RequestInit), loadGroupMap()])
    return fromPackFile(file, groups)
  })().catch((e) => {
    packP = null
    throw e
  })
  packP = p
  return p
}
