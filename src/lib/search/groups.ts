/** eBird's named groups, with inclusive bounds in the pinned taxonomy's taxon order. */
export type SearchLang = 'en' | 'es' | 'pt' | 'nl'
export type BirdGroup = {
  id: string
  name: Record<SearchLang, string>
  lo: number
  hi: number
}
export type GroupsFile = { v: 1; taxonomy: string; groups: BirdGroup[] }
export const inGroup = (taxonOrder: number, group: BirdGroup): boolean => taxonOrder >= group.lo && taxonOrder <= group.hi
