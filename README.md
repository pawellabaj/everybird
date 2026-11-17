# Everybird

A lifetime of birds. Everybird turns a birder's life list into a sticker collage. Import an eBird or observation.org export, use an iNaturalist username, or tick birds off by hand, and your list is laid out as a collage you can filter, edit and share.

Your list never leaves your browser. The only network calls that carry user input are iNaturalist API requests (a username and place IDs). A share link carries the whole list in the link itself. Anonymous usage counts (visits, and a few actions such as a collage made or an image shared, never list contents) are sent to a stats endpoint, and Cloudflare Web Analytics counts visits without cookies; both are skipped with Do Not Track or Global Privacy Control.

Live at https://everybird.yusuftaleb.com (share links, link previews and the share images' footer use this origin, `src/lib/share/origin.ts`).

## Pages

- **Collage** (`/`): your collage with the dock (Collage/List, True size, Scientific, Filters, search), the active filter chips, bird cards and Share. Without a list on the device it shows a sample.
- **Settings** (`/settings`): your sources (eBird files, iNaturalist, observation.org files, tick by hand), the match report, counting rules, and downloads, backup and restore.
- **About** (`/about`): how it works, privacy and every credit.
- **Shared view** (`/s/[token]`): a read-only collage from a share link. The old `/make`, `/my` and `/credits` redirect to Settings, Collage and About.

Light by default, with a sun/moon toggle in the top bar. The interface is in English, Español, Português (Brazil) and Nederlands; the language menu sits in the top bar. The design system is in `DESIGN.md`.

## Current capabilities

- Smart search and one Filters panel for places, time, taxonomy and conservation status.
- Vertical/Horizontal sharing: Story 9:16 or Desktop 16:9, Post 4:5 or 5:4, and Square; print posters A4–A1 in either orientation.
- Search metadata in all four languages, a `WebSite` site-name declaration on the homepage, and the landing demo excluded from search snippets. Google's displayed result can lag a deployment.
- Private anonymous-usage dashboard at `https://stats.yusuftaleb.com/dashboard`, behind Cloudflare Access. Days now follow America/Vancouver; the completed 2026-11-16 transition is documented in [the stats README](workers/stats/README.md).
- Sticker updates use the weekly [huashu sync workflow](.github/workflows/README.md); uploaded files only become live when the app's updated data is merged and deployed.

## Run it

```
npm install
npm run dev        # http://localhost:3000 (use -p for another port)
npm test           # Vitest unit tests
npm run e2e        # Yusuf only; agents do not run browser or visual tests
npm run data       # rebuild the species and geo data (see below)
```

Agents run lint, typecheck and unit tests only (see `AGENTS.md`). Existing browser specs are retained for Yusuf.

## Rebuilding the data

The generated files in `public/data/` are committed, so you only need this to update a source. The pipeline needs
the raw sources in `data/raw/` (git-ignored) and the stickers repo checked out next to this one as
`../everybird-stickers` (or set `STICKERS_OUT`). In order:

1. `npx tsx scripts/build-data/fetch-sources.ts`: downloads the eBird taxonomy, huashu-bird-sticker, Natural Earth and iso-codes into `data/raw/` and writes `data/raw/manifest.json`.
2. `npm run data`, which runs:
   1. `copy-synonyms.ts`: publishes `data/inat-synonyms.json`.
   2. `build-species.ts`: `species.v1.json` and `taxonomy.v1.json` (masses: `data/overrides.json` first, then AVONET, then BIRDBASE by name, then the genus, family or order median).
   3. `build-names.ts`: the bird names per language (`names.*.v1.json`).
   4. `build-groups.ts`: `groups.v1.json`, the eBird species groups the smart search matches.
   5. `build-geo.ts`: `regions.v1.json` (country and province names).
   6. `build-stickers.ts`: the 128/384 webp stickers into `../everybird-stickers/v1/`, the masks and each species' `ar` (must follow build-species).
   7. `link-index.ts`: appends new codes to `data/link-index.json` (append-only, so old share links keep working).
3. `npx tsx scripts/build-data/check-stickers.ts`: decodes every sticker and lists any broken file (rebuild those with `build-stickers.ts --codes a,b`).

## Data sources and licences

- **Stickers:** [huashu-bird-sticker](https://github.com/alchaincyf/huashu-bird-sticker), CC BY 4.0. Credited wherever stickers appear.
- **Taxonomy:** eBird/Clements checklist, used for species names and codes. Every source, with its licence, is also listed on the in-app credits (About, `/about#credits`).
- **Body masses:** [AVONET](https://doi.org/10.1111/ele.13898) (CC BY 4.0) via huashu's species table, with a few sourced overrides in `data/overrides.json`; and [BIRDBASE](https://doi.org/10.1038/s41597-025-05615-3) (CC BY 4.0) for the species AVONET gives no mass for. Its compact extract is `data/raw/birdbase/` (see its README).
- **Regions:** place names from Natural Earth (public domain) and [Debian iso-codes](https://salsa.debian.org/iso-codes-team/iso-codes) ISO 3166-2 data (LGPL-2.1), used for names only.
- **Fonts:** Satoshi and Cabinet Grotesk from [Fontshare](https://www.fontshare.com) (loaded from their CSS, not bundled), and Geist Mono via `next/font/google`.

## Licence

MIT, (c) 2026 Yusuf Taleb. See `LICENSE`. Stickers are CC BY 4.0 (huashu-bird-sticker) and the vendored Stageshow subset in `src/components/about/stageshow/` is MIT (its LICENSE beside it).
