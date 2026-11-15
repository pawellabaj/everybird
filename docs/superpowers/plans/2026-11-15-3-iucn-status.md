# Conservation Status (IUCN) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every species with a global IUCN Red List category (huashu's `conservation.iucn`, BirdLife v10 via AviList) carries it in `species.v1.json`; the controls bar gains a "Status" dropdown, the bird card a small Red List pill, the stats line a threatened count, and About a data note and credit. Species without a status show nothing.

**Architecture:** One shared vocabulary module (`src/lib/species/iucn.ts`: the eight categories, their names, the Red List colours, the parser) is used by the build and the app. `build-species` writes `iu` on a row only from the species' own same-concept huashu record (never a form's parent, never a broader or narrower taxon). The huashu sync digests the raw status and reports `iu` changes, and the lock is regenerated in the same change. In the app, `Filter.statuses` is one more dimension of the existing matcher (`filterKey` part `i:`). It reads `species.byCode.get(code).iu`, so the collage, the landing sample and the shared view all get it with no worker or link change. The Status panel copies the Places checklist. The pill and the threatened count each have preview variants (item 4's `useVariant`).

**Tech Stack:** Next.js app router, React 19, TypeScript, Phosphor icons, Vitest + Testing Library (jsdom), Playwright (Chromium, WebKit, Firefox), tsx build scripts.

**Spec:** `docs/superpowers/plans/2026-11-15-next-features.md`, item "3. Conservation status (IUCN)" (approved by Yusuf), plus `docs/superpowers/plans/2026-11-15-next-features-update.md` (design fit, variants, pushing). Research, verified: `.superpowers/research/iucn.md`. Read `AGENTS.md` (data pipeline, huashu sync, "Data files on R2", the no-stand-ins rule, TopBar's narrow-width paragraph), `DESIGN.md` (Colors, Dock, Places and Time dropdowns, Cards and tooltip, Accessibility) and `PRODUCT.md` first.

**Stacking:** branch `feat/nf-3-iucn` on top of item 5 (`feat/nf-5-smaller-places`), which sits on items 2 and 4. Build on their end state: item 5 moved `PlacesList` into `src/components/filters/PlacesList.tsx`, added `provinces`/`counties` to `Filter`, used `s:` and `k:` in `filterKey`, and gave `filterLabel`'s ctx a `regions`. Item 4 added `src/lib/variants.ts`. **Before Task 1:** check that `src/lib/variants.ts` exports `useVariant` and `readVariant`. If it doesn't, stop and rebase onto item 4's final commit. Never write a second switch. Cite symbols, not line numbers (the earlier items moved code).

## Global Constraints

- Data: "huashu-bird-sticker's `conservation.iucn` (BirdLife v10 via AviList, about 10.1k species), mapped to eBird codes through the existing sync. Species without a status show nothing."
- Filter: "a "Status" dropdown next to Places and Time (multi-select: LC, NT, VU, EN, CR, EW, EX, DD)."
- Card: "under or near the weight, a small rounded pill with the abbreviation in Red List colours: LC green, NT yellow-green, VU yellow, EN orange, CR red, EW and EX dark purple or black, DD grey. Tap or hover shows the full name ("Vulnerable"). Text contrast must pass on every colour."
- Red List colours (IUCN's official chart, verified): LC `#60C659`, NT `#CCE226`, VU `#F9E814`, EN `#FC7F3F`, CR `#D81E05`, EW `#542344`, EX `#000000`, DD `#D1D1C6`. Text `#1e1e24` on LC, NT, VU, EN and DD; `#ffffff` on CR, EW and EX (CR: white 5.11:1; ink 3.24:1 fails).
- Full names: Least Concern, Near Threatened, Vulnerable, Endangered, Critically Endangered, Extinct in the Wild, Extinct, Data Deficient.
- "A "threatened species" count (VU + EN + CR) where the list's totals are shown."
- "No marks on the collage or the share images." (The share image's filter label still names a Status filter in words, as it does for every filter: DESIGN.md "the filter is described in words on share images".)
- "About gets a short data note: source, version, and that statuses are global, not regional."
- No stand-ins (AGENTS.md, Yusuf 2026-11-06): a status is never borrowed from another taxon's record.
- Design fit (update, rule 4): DESIGN.md, `.impeccable/design.json` and the existing components. Same tokens, type, spacing, radii, motion and voice; no new visual language. The Red List colours are the one deliberate exception, recorded in DESIGN.md (Task 13).
- Copy (DESIGN.md "Voice and copy"): sentence case, plain words, no em dashes, no exclamation marks.
- 44px press targets; works at 320px, at 195/260 CSS px (Safari aA) and with 200% text; both themes.
- Ports: e2e uses 3100/3200/4100 only. R2 uploads, deploys and posting are Yusuf's. Pushing `feat/nf-*` is allowed once the branch is green (update, rules 1–2).

**Builder's decisions (made here):**
- Field: `iu?: IucnCat` on `SpeciesRow`, left out when there is none. 10,100 rows get one (LC 7,966, NT 906, VU 640, EN 356, CR 188, EW 5, EX 4, DD 35). That makes 1,184 threatened: about +100 KB raw, +6 KB brotli.
- `"CR (PE)"` (9) and `"CR (PEW)"` (2) parse to `CR`. The possibly-extinct flag is dropped (question 1).
- Status only from the species' own record with `taxonConcept === 'same'`. Not for the 22 form matches (16 of whose parents have one) and not for the 34 non-same concepts (broadened 31, new 1, split 1, narrowed 1). Lumps already never match. Showing nothing is the conservative choice, since a wrong status is worse than none (question 2).
- Unknown upstream values (anything but the eight, with or without a parenthesised suffix) give no status. They are listed in the crosswalk report.
- Filter: `Filter.statuses?: IucnCat[]` in `IUCN_CATS` order, never empty when set. Key part `i:LC,VU` (`o f c s k y r` are taken). Once any status is chosen, species without one are left out.
- The Status button is hidden when no species on the list has a status and none is checked (as `hide` leaves out Places on a link without places). On the shared view it shows whenever the link's birds have statuses.
- Status panel: the head "Categories · N" with Clear; a Muted note: "Global IUCN Red List categories. Birds without one are left out once you pick a category."; a checklist in `IUCN_CATS` order with checkbox, pill (`aria-hidden`), full name and count; rows only for categories with species under the other filters, plus checked ones at 0. Glyph: Phosphor `Leaf`. Summary "Status · 2"; accessible name "Status: Vulnerable, Endangered". The group's label becomes "Places, time and status".
- Share label: `{VU, EN, CR}` exactly reads "Threatened"; else "Vulnerable", "Vulnerable + Endangered", "Vulnerable and 2 more". It sits after the birds and before the places: "Herons · Threatened · Canada".
- Threatened count: the stats line (it is where the totals are: collage, landing sample and shared view share it), only on the unfiltered line, hidden at 0 (and so on a list with no statuses). The landing sample has none, so its line and `e2e/import.spec.ts`'s regex stay as they are.
- Pill: a toggletip button in the card only. The hover tooltip, list rows, search, collage and share images get no pill.
- List view, DockSearch, link previews, the share link format: unchanged.
- About's version text is a constant (`IUCN_SOURCE`), not a `species.v1.json` head field. A head field would break `initLock`'s whole-file check, and the sync's `{ ...repo.species }` would never refresh it. AGENTS.md says to update it with AviList's yearly release.

**Preview variants** (item 4's `useVariant`; `a` is this plan's design; unit tests and e2e pin `a`):

| Key | Option | Looks like |
|---|---|---|
| `pill` | `a` | In the card head's right column, the pill under the mass, right-aligned (mass over pill). The toggletip label floats under the pill, right-aligned. |
| `pill` | `b` | On the mass's own line, left of it, 6px gap: `[VU] 2.4 kg`. The label floats under the pill, left-aligned to it. |
| `threat` | `a` | Stats line part after families: "197 species · 20 orders · 50 families · 12 threatened · since Jan 2020". |
| `threat` | `b` | Same place, the wording "12 globally threatened". |
| `threat` | `c` | Not in the stats line. The Status panel shows a Muted line under its note: "12 threatened: Vulnerable, Endangered or Critically Endangered." |

## Review Focus

1. A list where no species has a status (synthetic codes, an unusual import), and the shared view of one: there is no Status button, no threatened part, and the bar's rows look as before. On a list that has statuses but where some birds lack one (871 species upstream, American Robin among them), the pill is absent and a status filter leaves those birds out (Task 5 test, Task 7 test).
2. The three-button second row at 320/390/430/440 and at 195/260 CSS px (Safari aA): resting labels never truncate; no control sits alone; nothing scrolls sideways (Task 8 e2e).
3. The bar between the old 820px break and the new one. Three dropdowns inline must never push the magnifier or overflow, so the sweep runs to 1100px and the filter buttons always share one top (Task 8 e2e).
4. Dark theme: the EX (black) and EW pills on dark Paper `#1e1e24`, and the VU, NT and DD pills on light Paper, need a visible edge. The Line ring meets 3:1 against Paper in both themes (Task 1 contrast test, Task 9 screenshots).
5. A huashu sync where only statuses changed: it must open a PR whose body says "status LC → NT", not exit quietly. A regenerated lock must not show about 10k changed records in the next PR (Task 3 test, Task 4 check).

---

### Task 1: The status vocabulary

**Files:**
- Create: `src/lib/species/iucn.ts`
- Test: `tests/iucn.test.ts`

**Interfaces:**
- Produces:
  - `export const IUCN_CATS = ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD'] as const`; `export type IucnCat = (typeof IUCN_CATS)[number]`
  - `export const THREATENED: readonly IucnCat[] = ['VU', 'EN', 'CR']`
  - `export const IUCN_NAMES: Record<IucnCat, string>` (the full names above)
  - `export const IUCN_COLORS: Record<IucnCat, { fill: string; text: string }>` (the constraint values, lowercase hex)
  - `export const IUCN_SOURCE = 'BirdLife v10 via AviList v2026'`
  - `export function parseIucn(raw: string | undefined): IucnCat | undefined`: `/^(LC|NT|VU|EN|CR|EW|EX|DD)(?: \([A-Z]+\))?$/` on the trimmed string; anything else is undefined.
  - `export function isIucnCat(x: unknown): x is IucnCat`

- [ ] **Step 1: Write the failing tests**

```ts
it('parses the eight categories and the possibly-extinct CRs; nothing else', () => {
  expect(parseIucn('VU')).toBe('VU')
  expect(parseIucn('CR (PE)')).toBe('CR')
  expect(parseIucn('CR (PEW)')).toBe('CR')
  for (const bad of [undefined, '', 'NE', 'RE', 'LR/cd', 'vu', 'VU?', 'CR PE']) expect(parseIucn(bad)).toBeUndefined()
})
it('names and the official Red List colours', () => {
  expect(IUCN_NAMES.EW).toBe('Extinct in the Wild')
  expect(IUCN_COLORS).toMatchObject({ LC: { fill: '#60c659' }, CR: { fill: '#d81e05', text: '#ffffff' }, EX: { fill: '#000000', text: '#ffffff' }, VU: { text: '#1e1e24' } })
})
it('every pill text passes AA (4.5:1) on its fill', () => {
  for (const c of IUCN_CATS) expect(contrast(IUCN_COLORS[c].text, IUCN_COLORS[c].fill), c).toBeGreaterThanOrEqual(4.5)
})
it('the pill ring (Line) meets 3:1 against Paper in both themes', () => {
  expect(contrast('#857f74', '#f6f4ef')).toBeGreaterThanOrEqual(3)
  expect(contrast('#76767f', '#1e1e24')).toBeGreaterThanOrEqual(3)
})
```

(`contrast` is copied from `tests/tokens.test.ts`, or exported from a small `tests/contrast.ts` that both import.)

- [ ] **Step 2: Run it to see it fail.** `npx vitest run tests/iucn.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `iucn.ts`.**
- [ ] **Step 4: Run it to see it pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(iucn): the Red List categories, names, colours and parser"`

---

### Task 2: Species rows carry their own status

**Files:**
- Modify: `src/lib/species/types.ts` (`SpeciesRow.iu?: IucnCat`, `HuashuRecord.conservation?: { iucn?: string }`), `scripts/build-data/build-species.ts` (`formMatch`, new `statusOf`, the row literal in `buildSpecies`, two report lists)
- Test: `tests/build-species.test.ts` (fixtures stay synthetic: add `conservation` to records in `tests/fixtures/build/huashu.json` or inline records as the forms describe does)

**Interfaces:**
- Consumes: Task 1's `parseIucn`, `IucnCat`.
- Produces: `export function statusOf(rec: HuashuRecord | undefined): { iu?: IucnCat; why?: 'concept' | 'unknown' }`. It returns `iu` when `rec` has no `form`, `rec.taxonConcept === 'same'` and `parseIucn` accepts `rec.conservation?.iucn`. It returns `why: 'concept'` when a status is present but the concept isn't `same`, and `why: 'unknown'` when the string doesn't parse. `formMatch` also deletes `conservation`. The row literal gets `...(iu ? { iu } : {})` right after `q`, so keys stay `code … q, iu` and `sv` follows. New report sections: "No status: huashu's taxon is not eBird's (N)" (code, com, concept, raw value) and "Unrecognised IUCN values (N)".

- [ ] **Step 1: Write the failing tests**

```ts
describe('conservation status', () => {
  it('the own record’s category; CR (PE) is CR; none without one', () => {
    // records: one1 { iucn: 'VU' }, two1 { iucn: 'CR (PE)' }, nost1 no record, three1 record without conservation
    expect(row('one1').iu).toBe('VU'); expect(row('two1').iu).toBe('CR')
    expect('iu' in row('nost1')).toBe(false); expect('iu' in row('three1')).toBe(false)
  })
  it('never through a form: the parent’s status is another taxon’s', () => { /* the forms fixture's parent gets { iucn: 'LC' }: the form-matched code has no iu */ })
  it('not when huashu’s taxon is broader or narrower than eBird’s', () => { /* taxonConcept 'broadened' with iucn 'VU': no iu, listed under "No status: huashu's taxon is not eBird's" */ })
  it('an unknown value is no status and is reported', () => { /* iucn 'NE': no iu; report has "Unrecognised IUCN values (1)" */ })
  it('rows without a status keep their exact keys (the file stays small)', () => {
    expect(Object.keys(row('nost1'))).toEqual(['code', 'com', 'sci', 'ord', 'fam', 'famCom', 'to', 'g', 'gSrc', 'st', 'ar', 'q'])
  })
})
```

- [ ] **Step 2: Run them to see them fail.** `npx vitest run tests/build-species.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `statusOf`, the `formMatch` delete, the row field and the report lists.
- [ ] **Step 4: Run them to see them pass.** `npx vitest run tests/build-species.test.ts tests/huashu-sync.test.ts`. Expected: PASS. (`tests/huashu-sync.test.ts`'s "the committed lock" still passes: it checks `st` and the commit only.)
- [ ] **Step 5: Commit.** `git commit -m "feat(data): species rows carry their own IUCN status, never a form's or a broader taxon's"`

---

### Task 3: The huashu sync sees status changes

**Files:**
- Modify: `scripts/sync/huashu-lib.ts` (`recordDigest` and its doc comment, `diffRows` and its doc comment)
- Test: `tests/huashu-sync.test.ts`

**Interfaces:**
- Produces: `recordDigest` pushes `['iucn', h.conservation.iucn]` (the raw string, so a `CR` → `CR (PE)` change counts) only when it is present, after the forms entry. A record without a status digests exactly as before, so the synthetic fixture's digests don't move. `diffRows` adds `status ${p.iu ?? 'none'} → ${r.iu ?? 'none'}` when `p.iu !== r.iu`.

- [ ] **Step 1: Write the failing tests** (beside "digests only the fields the build reads" and the row-changes test)

```ts
it('digests the IUCN status only when there is one', () => {
  const [a] = huashu; const d = recordDigest(a)                      // fixture records have no conservation
  const vu = { ...clone(a), conservation: { iucn: 'VU' } } as HuashuRecord
  expect(recordDigest(vu)).not.toBe(d)
  expect(recordDigest({ ...clone(vu), conservation: { iucn: 'EN' } } as HuashuRecord)).not.toBe(recordDigest(vu))
  expect(recordDigest({ ...clone(vu), conservation: { iucn: 'VU', cites: 'II' } } as HuashuRecord)).toBe(recordDigest(vu)) // CITES: no effect
})
it('row changes: a status change alone is a data change', () => {
  const before = clone(huashu); before[0].conservation = { iucn: 'LC' }
  const after = clone(huashu); after[0].conservation = { iucn: 'NT' }; after[1].conservation = { iucn: 'EN' }
  expect(diffRows(buildSpecies(before, taxa, {}).file.species, buildSpecies(after, taxa, {}).file.species)).toEqual([
    { code: 'whibir1', fields: ['status LC → NT'] }, { code: 'blabir1', fields: ['status none → EN'] },
  ])
})
```

(The fixture records carry `taxonConcept: 'same'`; check this and set it in the test if not.)

- [ ] **Step 2: Run them to see them fail.** `npx vitest run tests/huashu-sync.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(sync): huashu status changes are build-relevant and named in the PR"`

---

### Task 4: Regenerate the committed data

`data/raw` is a symlink to the main checkout's `data/raw`. It was verified on 2026-11-15: `assertRawPinned` passes, `data/raw/huashu` is clean at the lock's `442341a`, and rebuilding from `data/raw/ebird-taxonomy.json` reproduces today's `species.v1.json` and `taxonomy.v1.json` byte for byte. Run `build-species.ts` alone. Never run `npm run data` here: it needs the stickers dir and rebuilds geo and masks.

**Files:**
- Modify (generated): `public/data/species.v1.json`, `data/build/crosswalk-report.md`, `public/data/sample-pack.v1.json`, `src/lib/data-files.ts`, `data/huashu.lock.json`

- [ ] **Step 1: Rebuild in order**

```bash
npx tsx scripts/build-data/build-species.ts
npx tsx scripts/build-data/build-sample-pack.ts
npx tsx scripts/build-data/data-files.ts
npx tsx scripts/sync/huashu-sync.ts --init-lock --huashu-dir data/raw/huashu
```

Expected: `--init-lock` prints "(verified against the tree and species.v1.json)". It fails if `buildSpecies` doesn't reproduce the new file exactly.

- [ ] **Step 2: Check that only `iu` changed.** Write a throwaway `/private/tmp/claude-501/iucn-diff.mts` that loads `git show HEAD:public/data/species.v1.json` and the new file, deletes `iu` from every new row, and compares them with `JSON.stringify`. Expected: equal. Its counts print `10100` rows with `iu` and `1184` threatened. Also run `git diff --quiet public/data/taxonomy.v1.json public/data/masks public/data/masks.v2.json data/sticker-versions.json`, which must exit 0. In the lock diff, only `records` values change (none of `commit`, `files`, `codes` or `shipped`).
- [ ] **Step 3: Run the data tests.** `npx vitest run tests/data-files.test.ts tests/sample-pack.test.ts tests/huashu-sync.test.ts tests/build-species.test.ts tests/howto-data.test.ts`. Expected: PASS.
- [ ] **Step 4: Commit** the five files together with nothing else: `git commit -m "data: IUCN status on 10,100 species (AviList v2026, BirdLife v10); lock regenerated"`

---

### Task 5: The filter model

**Files:**
- Modify: `src/lib/list/filters.ts` (`Filter`, its doc comment, `filterKey`, `matcher` (a `'status'` dim), new `statusOptions` / `toggleStatus` / `withStatuses` / `threatenedCount`, `filterToShow`), `src/lib/list/filters-validate.ts`
- Test: `tests/filters-status.test.ts` (new; a synthetic `buildSpeciesIndex` with `iu` on some rows)

**Interfaces:**
- Consumes: Task 1's `IUCN_CATS`, `THREATENED`, `isIucnCat`.
- Produces:
  - `Filter.statuses?: IucnCat[]`
  - `withStatuses(f: Filter, cats: readonly string[]): Filter` (valid only, deduped, `IUCN_CATS` order, empty drops the field); `toggleStatus(f: Filter, cat: IucnCat): Filter`
  - `statusOptions(list: ListEntry[], f: Filter, species: SpeciesIndex, seen?: SeenIndex): (ChipOption & { value: IucnCat })[]`: counts under every other filter, whatever statuses are checked, only `count > 0`, `IUCN_CATS` order, `label` the full name
  - `threatenedCount(entries: readonly ListEntry[], species: SpeciesIndex): number`
  - `filterKey` appends `i:<cats>` last, only when set (every existing key unchanged)
  - `applyFilterValidity`: `withStatuses` always; with `pruneValues`, it also drops categories no entry has.

- [ ] **Step 1: Write the failing tests** (rows: duck `LC`, owl `VU`, crow `EN`, robin no `iu`; owl and duck in Strigiformes/Anseriformes as needed)

```ts
it('keeps the species in any checked category; species without a status are left out', () => {
  expect(codes({ statuses: ['VU', 'EN'] })).toEqual(['crow', 'owl'])
  expect(codes({ statuses: ['LC'] })).toEqual(['duck'])
  expect(codes({})).toContain('robin')
})
it('statusOptions: counted under the other filters, whatever is checked, in Red List order', () => {
  expect(statusOptions(list, {}, species).map((o) => [o.value, o.count, o.label])).toEqual([['LC', 1, 'Least Concern'], ['VU', 1, 'Vulnerable'], ['EN', 1, 'Endangered']])
  expect(statusOptions(list, { statuses: ['LC'] }, species)).toEqual(statusOptions(list, {}, species))
  expect(statusOptions(list, { order: 'Strigiformes' }, species).map((o) => o.value)).toEqual(['VU'])
})
it('toggle and normalise', () => {
  expect(toggleStatus({}, 'EN')).toEqual({ statuses: ['EN'] })
  expect(toggleStatus({ statuses: ['EN'] }, 'EN')).toEqual({})
  expect(withStatuses({}, ['CR', 'VU', 'VU', 'NE', 'xx'])).toEqual({ statuses: ['VU', 'CR'] })
})
it('keys: unchanged without statuses, i: last', () => {
  expect(filterKey({ order: 'X' })).toBe('o:X')
  expect(filterKey({ order: 'X', statuses: ['VU', 'EN'] })).toBe('o:X|i:VU,EN')
})
it('threatened: VU + EN + CR only', () => { expect(threatenedCount(list, species)).toBe(2) })
it('a search pick outside the status filter clears it', () => {
  expect(filterToShow({ statuses: ['VU'] }, entry('robin'), species)).toEqual({})
  expect(filterToShow({ statuses: ['VU'] }, entry('owl'), species)).toEqual({ statuses: ['VU'] })
})
it('validity: bad values go; after a list change, categories no species has go', () => {
  expect(applyFilterValidity({ statuses: ['EX', 'VU', 'zz'] as never }, list, species, false)).toEqual({ statuses: ['VU', 'EX'] })
  expect(applyFilterValidity({ statuses: ['EX', 'VU'] }, list, species, true)).toEqual({ statuses: ['VU'] })
})
```

- [ ] **Step 2: Run them to see them fail.** `npx vitest run tests/filters-status.test.ts`. Expected: FAIL (not exported).
- [ ] **Step 3: Implement.** The matcher's status test: `const set = statuses && new Set(statuses)`, then `if (set && !(row?.iu && set.has(row.iu))) return false`. Fetch the row once per entry, shared with the order/family branch.
- [ ] **Step 4: Run them to see them pass, then the filter suites.** `npx vitest run tests/filters-status.test.ts tests/filters.test.ts tests/filters-places.test.ts tests/store.test.ts tests/collage-layout-hook.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(status): Filter.statuses, counted per category; threatenedCount"`

---

### Task 6: Status in words (the button and the share image)

**Files:**
- Modify: `src/lib/list/filter-summary.ts` (new `statusSummary`, `statusSpoken`, `statusLabel`), `src/lib/share/image.ts` (`filterLabel` only)
- Test: `tests/filter-summary.test.ts`, `tests/share-image.test.ts` (`describe('filterLabel')`)

**Interfaces:**
- Produces: `statusSummary(f: Filter): string | undefined` ("2"); `statusSpoken(f: Filter): string | undefined` ("Vulnerable, Endangered"); `statusLabel(statuses: readonly IucnCat[] | undefined): string | undefined`. `filterLabel` puts `statusLabel(f.statuses)` after the birds part and before places. No ctx change; `ShareDialog` is untouched.

- [ ] **Step 1: Write the failing tests**

```ts
expect(statusSummary({ statuses: ['VU', 'EN'] })).toBe('2')
expect(statusSpoken({ statuses: ['VU', 'EN'] })).toBe('Vulnerable, Endangered')
expect(statusLabel(['VU', 'EN', 'CR'])).toBe('Threatened')
expect(statusLabel(['EN'])).toBe('Endangered')
expect(statusLabel(['VU', 'EN'])).toBe('Vulnerable + Endangered')
expect(statusLabel(['NT', 'VU', 'EN', 'CR'])).toBe('Near Threatened and 3 more')
expect(filterLabel({ order: 'Pelecaniformes', family: 'Ardeidae', statuses: ['VU', 'EN', 'CR'], countries: ['EG'] }, ctx)).toBe('Herons, Egrets, and Bitterns · Threatened · Egypt')
```

- [ ] **Step 2: Run them to see them fail.** `npx vitest run tests/filter-summary.test.ts tests/share-image.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.** Same command, plus `tests/share-dialog.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(status): the Status button's summary and the share image's label"`

---

### Task 7: The Status dropdown

**Files:**
- Create: `src/components/filters/StatusList.tsx`, `src/components/collage/IucnPill.tsx` (both forms; the card's button is finished in Task 9)
- Modify: `src/components/filters/FilterDropdowns.tsx` (`Panel`, `PANELS`, `summary`/`spoken`, the panel switch, the hide rule, the group's `aria-label`, the header comment), `src/components/filters/filters.css` (`.eb-status-row`), `src/components/collage/card-list.css` (`.eb-iucn`)
- Test: `tests/status-ui.test.tsx` (new, on `places-ui.test.tsx`'s Harness pattern), `tests/places-ui.test.tsx` (only where it names the group "Places and time")

**Interfaces:**
- Consumes: Task 5's `statusOptions`, `toggleStatus`, `withStatuses`; Task 6's `statusSummary`, `statusSpoken`; Task 1's `IUCN_COLORS`, `IUCN_NAMES`.
- Produces:
  - `type Panel = 'places' | 'time' | 'status'`; `PANELS` gains `{ id: 'status', label: 'Status', Icon: Leaf }` last.
  - `IucnPill({ cat, as = 'span' }: { cat: IucnCat; as?: 'span' | 'button' })`: `className="eb-iucn" data-cat={cat}` with inline `--iucn-fill` / `--iucn-text` from `IUCN_COLORS`. The span form is `aria-hidden`.
  - `StatusList({ state, species, threatLine, onFilter }: { state: AppState; species: SpeciesIndex; threatLine?: number; onFilter: (f: Filter) => void })`. Test ids: `status-<CAT>` (checkbox), `status-clear`, `status-threatened` (variant c's line).
  - The Status button shows when `hasStatus = state.filter.statuses?.length || state.list.some((e) => species.byCode.get(e.code)?.iu)` (memoised on `state.list` and `species`). `hide` may also name `'status'`.

Pill CSS (DESIGN.md's mono label, the switch track's full rounding): `display:inline-flex; align-items:center; height:18px; padding:0 6px; border-radius:9px; background:var(--iucn-fill); color:var(--iucn-text); box-shadow:inset 0 0 0 1px var(--line); font:600 11px/1 var(--font-mono); letter-spacing:.06em`. The fill and text colours are fixed and identical in both themes; only the ring follows the theme.

- [ ] **Step 1: Write the failing tests** (rows with `iu`: duck LC, owl VU, crow EN; robin none)

```tsx
it('a Status button after Time; its panel lists the categories on the list, in Red List order, with counts', () => {
  render(<Harness />); fireEvent.click(statusBtn())
  expect(screen.getByText(/Categories · 3/)).toBeInTheDocument()
  expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('data-testid'))).toEqual(['status-LC', 'status-VU', 'status-EN'])
  expect(screen.getByRole('checkbox', { name: 'Vulnerable, 1 species' })).toBeInTheDocument()
  expect(screen.getByText('Global IUCN Red List categories. Birds without one are left out once you pick a category.')).toBeInTheDocument()
})
it('checking filters live; the button says how many and names them; Clear clears', () => {
  // check VU then EN: filter { statuses: ['VU','EN'] }; statusBtn() text "Status · 2", aria-label "Status: Vulnerable, Endangered"; status-clear -> {}
})
it('a checked category another filter empties stays at 0 so it can be unchecked', () => { /* check EN, dispatch order Strigiformes: status-EN checked, count 0 */ })
it('no Status button on a list where no species has a status', () => { /* seeded with robin only: queryByTestId('filter-tab-status') is null */ })
it('Esc closes the panel and focus returns to the Status button; at phone width it is the bottom sheet', () => { /* as the Places tests */ })
```

- [ ] **Step 2: Run them to see them fail.** `npx vitest run tests/status-ui.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `StatusList` on `PlacesList`'s structure (`.eb-places-head`, `.eb-checklist`, `.eb-check`, `.eb-count`, `.eb-sr`; no search field: at most 8 rows). Each label holds the checkbox, the span pill, the full name and the count.
- [ ] **Step 4: Run them to see them pass.** `npx vitest run tests/status-ui.test.tsx tests/places-ui.test.tsx tests/timeline-ui.test.tsx tests/collage-controls.test.tsx tests/shared-view.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(status): the Status dropdown in the controls bar"`

---

### Task 8: Three dropdowns in the controls bar

**Files:**
- Modify: `src/components/app/app.css` (the dock's container rules), `e2e/dock-sweep.spec.ts`, `e2e/responsive.spec.ts`, `e2e/text-size.spec.ts`

Two numbers have to be measured, not guessed. In Chromium, on a seeded list with statuses, set `.eb-dockwrap`'s width as `dock-sweep` does. Put the longest summaries on the buttons ("Places · 12", "Time · 2022–2024", "Status · 3"):
- **W (one-row break):** the smallest bar width where tabs (with words), tools, all three dropdowns and the magnifier fit on one row with 8px to spare, rounded up to the next 20px. Replace the `@container (max-width: 819px)` rule (and its comment, and `.eb-find`'s line inside it) with `max-width: W-1px`. The estimate is about 940.
- **G (glyphs drop):** the bar width below which a resting label ("Places", "Time", "Status") would be cut in the three-way row. Add `@container (max-width: G-1px) { .eb-dock-filters .eb-dock-drop { gap: 0; padding: 0 6px } .eb-dock-filters .eb-dock-drop svg { display: none } }`, the rule the `max-width: 299px` media query already applies. The estimate is about 330. Summaries may still ellipsis, as "Time · 2022–2024" does at 320 today; the accessible name stays whole.

- **Under 300px of page (Safari aA, the `max-width: 299px` and `239px` media rules)**, the grid keeps its areas, but equal thirds don't fit. At 195 the bar is about 153px inside, so each third leaves about 36px of text against "Places" at about 45px. At 260 the row two cell beside the magnifier is about 166px. In both rules the filter buttons become content-sized (`flex: 0 1 auto`, the group `justify-content: space-between`). Then apply the fallbacks in this order until the resting labels fit: padding `0 4px`, then the label at 14px, then (195 only) an ellipsis. The acceptance below states what is guaranteed: uncut resting labels at 260, and at 195 only one shared row and no overflow.

- [ ] **Step 1: Update the specs first**
  - `dock-sweep.spec.ts`: sweep `280..1100`. In `sweep`, also push `${w}:filters split` when the `.eb-dock-drop` buttons' rounded tops differ, and `${w}:label cut` when a button's `.eb-drop-label` has `scrollWidth > clientWidth` while it has no summary. Seed a list with statuses (the landing sample has NT birds, so the Status button shows there; assert `filter-tab-status` is visible first).
  - `responsive.spec.ts`: `expect(m.rows[1]).toEqual([/^Places/, /^Time/, /^Status/])` (as `stringMatching`). `dockGaps` is unchanged.
  - `text-size.spec.ts`: the 195/260 controls-bar test also asserts that the three `.eb-dock-drop` buttons share one top and end inside the bar. At 260 it also asserts that each resting label is uncut.
- [ ] **Step 2: Run them to see them fail.** `STICKERS_DIR=/Users/yusuf/orca/projects/everybird-stickers npx playwright test e2e/dock-sweep.spec.ts e2e/responsive.spec.ts --project=chromium`. Expected: FAIL (overflow between 820 and W; three buttons where the spec expects them).
- [ ] **Step 3: Measure W and G, and write the CSS.**
- [ ] **Step 4: Run them in both engines.** `STICKERS_DIR=/Users/yusuf/orca/projects/everybird-stickers npx playwright test e2e/dock-sweep.spec.ts e2e/responsive.spec.ts e2e/text-size.spec.ts --project=chromium --project=webkit`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(status): three dropdowns in the controls bar, one row from W px, glyphs off under G"`

---

### Task 9: The pill in the bird card

**Files:**
- Modify: `src/components/collage/IucnPill.tsx` (the `button` form and its toggletip), `src/components/collage/BirdCard.tsx` (`BirdFacts` gains `status?: boolean`; `BirdCard` passes it; `useVariant('pill', ['a', 'b'] as const)`), `src/components/collage/card-list.css` (`.eb-card-meta`, `.eb-iucn-tip`, the `::after` press area)
- Test: `tests/card-list.test.tsx`

**Interfaces:**
- Consumes: item 4's `useVariant`; Task 7's `IucnPill`.
- Produces: `IucnPill as="button"` renders `<span className="eb-iucn-wrap" data-open={open || undefined} data-testid="iucn-wrap"><button type="button" className="eb-iucn" aria-label="VU, Vulnerable (IUCN Red List)" aria-expanded={open} aria-controls={tipId} data-testid="iucn-pill">VU</button><span id={tipId} className="eb-iucn-tip" aria-hidden="true">Vulnerable</span></span>`. The tip is visual only, since the button's name already carries the full name. A press toggles `open`. The tip shows on `[data-open]`, on `:focus-visible`, and on `:hover` under `(hover: hover) and (pointer: fine)`. The card's Esc still closes the card.

Tip look (the card's floating look in small): Paper, 1px Hairline, the one floating shadow, a 8px squircle (`calc(8px * var(--one-if-corner-shape-supported, .566))`, `corner-shape: superellipse(2)`), Geist Mono 12px Ink, `padding: 4px 8px`, `white-space: nowrap`, absolutely placed 4px under the pill (right-aligned in `a`, left-aligned in `b`), above the date line, a 150ms fade on `--ease-ui` and none with reduced motion. The pill's `::after` (`position: absolute; inset: -13px -9px`) gives a 44px press and must not overlap the close button. In `a` the right column is `.eb-card-meta` (flex column, `align-items: flex-end`, 4px gap): mass, then pill. In `b`, `.eb-card-meta` is a row: pill, then mass.

- [ ] **Step 1: Write the failing tests**

```tsx
it('the card shows the Red List pill under the mass; a press shows the full name', () => {
  renderCard({ iu: 'VU' })
  const pill = screen.getByTestId('iucn-pill')
  expect(pill).toHaveTextContent('VU'); expect(pill).toHaveAccessibleName('VU, Vulnerable (IUCN Red List)')
  expect(pill).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByTestId('iucn-wrap')).not.toHaveAttribute('data-open')
  fireEvent.click(pill)
  expect(pill).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByTestId('iucn-wrap')).toHaveAttribute('data-open')
  expect(screen.getByTestId('iucn-wrap')).toHaveTextContent('Vulnerable')
  fireEvent.click(pill); expect(screen.getByTestId('iucn-wrap')).not.toHaveAttribute('data-open')
  expect(pill.style.getPropertyValue('--iucn-fill')).toBe('#f9e814')
})
it('no pill for a species without a status, and never in the hover tooltip', () => {
  renderCard({}); expect(screen.queryByTestId('iucn-pill')).toBeNull()
  render(<BirdFacts entry={entry} row={{ ...row, iu: 'EN' }} regions={regions} heading={false} />)
  expect(screen.queryByTestId('iucn-pill')).toBeNull()
})
it('CR, EW and EX have white text', () => { /* renderCard({ iu: 'CR' }): style --iucn-text is #ffffff */ })
```

- [ ] **Step 2: Run them to see them fail.** `npx vitest run tests/card-list.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement both variants.**
- [ ] **Step 4: Run them to see them pass.** `npx vitest run tests/card-list.test.tsx tests/bird-tip.test.ts tests/collage-controls.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(status): the Red List pill in the bird card, a toggletip with the full name (variants pill a/b)"`

---

### Task 10: The threatened count

**Files:**
- Modify: `src/components/app/CollageView.tsx` (`statsLine`, `useVariant('threat', ['a', 'b', 'c'] as const)`, passes `threatLine` down to `FilterDropdowns` → `StatusList` for `c`), `src/components/filters/FilterDropdowns.tsx` (a `threatLine?: number` prop passed through)
- Test: `tests/collage-controls.test.tsx` (or a new `tests/stats-line.test.ts` for the pure function)

**Interfaces:**
- Consumes: Task 5's `threatenedCount`.
- Produces: `statsLine(all: ListEntry[], shown: ListEntry[], species: SpeciesIndex, threat: 'a' | 'b' | 'c' = 'a'): string`. On the unfiltered line, when `threatenedCount(all) > 0` and `threat !== 'c'`, it inserts `"N threatened"` (`a`) or `"N globally threatened"` (`b`) after the families part, before "since". The filtered line is unchanged. The count is the list's own entries (`entries`, after the rules), formatted with `toLocaleString('en-US')`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(statsLine(all, all, species)).toBe('4 species · 3 orders · 4 families · 2 threatened · since Jan 2020')
expect(statsLine(all, all, species, 'b')).toContain(' · 2 globally threatened · ')
expect(statsLine(all, all, species, 'c')).not.toContain('threatened')
expect(statsLine(all, all.slice(0, 2), species)).toBe('2 of 4 species · 2 families')
expect(statsLine(noStatus, noStatus, species)).not.toContain('threatened') // hidden at 0
// StatusList with threatLine 2: status-threatened reads "2 threatened: Vulnerable, Endangered or Critically Endangered."
```

- [ ] **Step 2: Run them to see them fail.** `npx vitest run tests/collage-controls.test.tsx tests/status-ui.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to see them pass.** Same command, plus `tests/app-routes.test.tsx tests/shared-view.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(status): the threatened count on the stats line (variants threat a/b/c)"`

---

### Task 11: About and the How it works scene

**Files:**
- Modify: `app/(app)/about/page.tsx`, `scripts/build-data/build-howto.ts` (writes `THREATENED`), `src/components/about/how-it-works-data.ts` (generated), `src/components/about/HowItWorksScene.tsx` (`Dock`: a third drop "Status" with `Leaf`; the stats line), `src/components/about/how-it-works.css` (only if the three drops need it)
- Test: `e2e/about.spec.ts`, `tests/howto-data.test.ts`


About copy (exact):
- In "What it is", "Filter it by group, place or year" becomes "Filter it by group, place, year or conservation status".
- A new section after "What True size means", `<section className="eb-block" aria-labelledby="eb-status-h">` with the h2 "Conservation status" and one `.eb-prose` paragraph: "Each species' status is its global IUCN Red List category, from BirdLife v10 via AviList v2026. It is global, not regional: a bird common where you live can still be threatened worldwide, and the other way round. Species without a category show none." (`IUCN_SOURCE` supplies "BirdLife v10 via AviList v2026".)
- A credit after AVONET: `<Credit label="Red List categories · CC BY 4.0" title={<A href="https://doi.org/10.2173/avilist.v2026">AviList</A>}>`: "IUCN Red List categories as given for BirdLife v10 in AviList: The Global Avian Checklist, v2026 (AviList Core Team, 2026), via huashu&apos;s species table." huashu's `NOTICE.md` says these categories come from AviList under CC BY 4.0, which requires attribution.

Scene: `build-howto.ts` exports `THREATENED` (the demo's VU/EN/CR count from `species.v1.json`'s `iu`; 1 today, `lesyel` VU). The scene's stats line reads `` `${TOTAL} species · ${ORDERS.length} orders · ${FAMILIES} families · ${THREATENED} threatened · since ${SINCE}` `` when `THREATENED > 0`, mirroring variant `a`. Its `Dock` gets the Status drop after Time in both designs. Rerun `npx tsx scripts/build-data/build-howto.ts`; `tests/howto-data.test.ts` must pass.

- [ ] **Step 1: Write the failing assertions.** In `about.spec.ts`'s first test: the "Conservation status" heading, the sentence matching `/global, not regional/`, the credit link `https://doi.org/10.2173/avilist.v2026` and the text "Red List categories · CC BY 4.0". In "the scene's labels are the product's": the scene's dock has three `.ebd-drop`s, the last reading "Status".
- [ ] **Step 2: Run them to see them fail.** `STICKERS_DIR=/Users/yusuf/orca/projects/everybird-stickers npx playwright test e2e/about.spec.ts --project=chromium`. Expected: FAIL.
- [ ] **Step 3: Implement the About copy, the build-howto export and the scene; rerun build-howto.**
- [ ] **Step 4: Run them to see them pass.** `npx vitest run tests/howto-data.test.ts`, then the same Playwright command with `--project=webkit --project=firefox` added. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(about): conservation status note and AviList credit; the scene's Status drop"`

---

### Task 12: End to end

**Files:**
- Create: `e2e/status.spec.ts`
- Modify: `playwright.config.ts` (add `status` to the webkit and firefox `testMatch`)

`e2e/status.spec.ts` (Chromium, WebKit, Firefox). It seeds as `places.spec.ts` does, picking codes from `public/data/species.v1.json` by `iu`: one LC, NT, VU, EN, two CR, one EW, EX and DD, all with `st`, plus two rows without `iu`. Desktop (1280) and phone (390, `hasTouch`) tests:
- the stats line contains "· 4 threatened ·";
- Status opens and lists eight categories; checking VU, EN and CR gives "4 of 11 species" and the button "Status · 3", and the stage shows 4 birds (`collage-stage` `[data-code]:not([data-off])`); Clear restores 11;
- a bird's card shows the pill: on desktop, hover shows "Vulnerable"; on the phone, a tap shows it and a second tap hides it; the press is at least 44×44 and doesn't overlap the close button;
- a species without a status has no pill;
- the shared view: copy the link from the share dialog (as `share-link.spec.ts` does) and open it. Status is there and filters, and the card has the pill;
- dark theme (`seed(..., 'dark')`): the EX pill's ring is visible (computed `box-shadow` contains the dark Line `rgb(118, 118, 127)`).

With `PILL_SHOTS=<dir>` the spec saves card and bar screenshots for `?v=pill:a`, `?v=pill:b`, `?v=threat:a|b|c` in light and dark at 390 and 1280. Those are for Yusuf's pick and the design reviewer (update, rules 4–5). Keep the directory outside the repo.
- [ ] **Step 1: Write the spec and add it to the config.**
- [ ] **Step 2: Run it.** `STICKERS_DIR=/Users/yusuf/orca/projects/everybird-stickers npx playwright test e2e/status.spec.ts --project=chromium --project=webkit --project=firefox`. Expected: PASS. If a test fails, the owning task (7–10) gets the fix.
- [ ] **Step 3: Commit.** `git commit -m "test(e2e): the Status filter, the card's pill and the threatened count, on the collage and the shared view"`

---

### Task 13: Docs and full verification

**Files:**
- Modify: `AGENTS.md`, `DESIGN.md`, `.impeccable/design.json`, `docs/superpowers/specs/2026-11-05-everybird-design.md`, `docs/superpowers/plans/2026-11-15-next-features.md`

Items 4, 2 and 5 edited AGENTS.md and DESIGN.md on this stack: edit the current text, and don't bring back older lines.

- `AGENTS.md`: Data pipeline (the `iu` field and its rules: own record, `same` concept, no forms, CR (PE) → CR, unknown values reported; regenerate with build-species → sample pack → data-files → `--init-lock`; update `IUCN_SOURCE` and About's note on AviList's yearly release). huashu sync (the digest includes the raw status; `diffRows` names "status A → B"). Structure (`iucn.ts`, `StatusList.tsx`, `IucnPill.tsx`, `Filter.statuses` and `i:`, the Status button and its hide rule, the stats line's threatened part, the card's toggletip, the new W and G breakpoints replacing "820"). The `responsive.spec.ts`/`dock-sweep.spec.ts`/`text-size.spec.ts` descriptions (three buttons, the sweep to 1100). `e2e/status.spec.ts` and `PILL_SHOTS`. The "Preview variants" paragraph: `pill` `a` (under the mass) / `b` (beside the mass); `threat` `a` ("N threatened") / `b` ("N globally threatened") / `c` (in the Status panel only).
- `DESIGN.md`: under Colors, a rule after the One Voice Rule:

  **The Red List Exception.** The seven tokens are the interface's only colours, except the IUCN Red List chart's eight category colours (LC #60C659, NT #CCE226, VU #F9E814, EN #FC7F3F, CR #D81E05, EW #542344, EX #000000, DD #D1D1C6). They are data, not voice, and appear only in the status pill (the bird card and the Status panel's rows). They never appear on the collage, the share images or the chips, or as decoration. They are the same in both themes. The text is `#1e1e24`, or `#ffffff` on CR, EW and EX (AA on every fill, `tests/iucn.test.ts`). A 1px Line ring keeps the edge at 3:1 on Paper in both themes. Accent is still the only interface accent.

  Also: "Places and Time dropdowns" becomes "Places, Time and Status dropdowns", with the Status panel; the Dock line uses the new break (W) and lists Status; Cards and tooltip adds the pill and toggletip; Shapes notes the pill's full rounding as the switch track's; Accessibility adds the pill's name, `aria-expanded` and the checkboxes "Vulnerable, 12 species".
- `.impeccable/design.json`: add a `redList` entry beside `colorMeta` (the eight fills, "data only: the status pill") and a "Status Pill" component snippet.
- The spec's "Changes after approval": a "Conservation status (2026-11-15)" entry. Tick item 3 in `2026-11-15-next-features.md`.


- [ ] **Step 1: Update the docs.**
- [ ] **Step 2: Verify**

Run: `npm run lint && npx next typegen && npx tsc --noEmit && npm test`
Expected: no errors; all Vitest tests pass.

Run: `STICKERS_DIR=/Users/yusuf/orca/projects/everybird-stickers npx playwright test e2e/status.spec.ts e2e/flows.spec.ts e2e/places.spec.ts e2e/responsive.spec.ts e2e/dock-sweep.spec.ts e2e/text-size.spec.ts e2e/about.spec.ts e2e/share-link.spec.ts e2e/import.spec.ts e2e/timeline.spec.ts --project=chromium --project=webkit --project=firefox`
Expected: PASS (each project runs only the specs in its `testMatch`).

Run once by hand: open `?v=pill:b`, `?v=threat:b` and `?v=threat:c` on `localhost:3100` and save the `PILL_SHOTS` screenshots. Have a high-effort design reviewer compare them with the current screens, light and dark, phone and desktop (update, rule 4), and list the variants with screenshots in the report.

- [ ] **Step 3: Commit.** `git commit -m "docs: conservation status (data rules, Status dropdown, pill, Red List colour exception, variants)"`

---

## Questions for Yusuf

Each has the conservative pick, which this plan builds.

1. Eleven species are "possibly extinct" (CR (PE), CR (PEW), e.g. Eskimo Curlew). They show plain CR. Should the toggletip add "possibly extinct"?
2. For 34 species, huashu's taxon is not eBird's (31 broadened, 1 new, 1 split, 1 narrowed): no status, since showing the wider species' category could be wrong. For the 16 form matches, the parent's category is not taken either. Keep both?
3. Huashu has no category for 871 records, including common birds (American Robin, Great Blue Heron). They show nothing, and the threatened count can only undercount. Should we ask huashu upstream about the gap?
4. The threatened count is on the unfiltered stats line only and hidden at 0. Variants `threat:a/b/c` test the wording and placement.
5. The Status button is hidden on a list where no species has a status. Keep it hidden, or show it disabled?

## Outward steps (Yusuf's, not the builder's)

- Before deploying to production: `npx tsx scripts/deploy/upload-stickers-r2.ts --data`, to upload the new hashed `species.v1.*.json` and `sample-pack.v1.*.json` to R2. Until then, previews and production fall back to `/data/<name>` on the deployment: it works, but every first visit costs a failed R2 request and a Vercel request.
- If a huashu-sync PR is open when this merges, it conflicts on `data/huashu.lock.json` and `public/data/*`: close it and rerun the "huashu sync" workflow.
- Pushing `feat/nf-3-iucn` for a private preview is already approved once the branch is green (update, rules 1–2). Production, R2 and posting stay with Yusuf.
- Optional: an upstream issue to huashu about the 871 missing categories (question 3) is posting, so Yusuf's call.
