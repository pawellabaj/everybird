# Item 8: observation.org import (brief, 2026-11-15)

Requested by Koen (observation.org user, via the site's contact form). Yusuf approved adding it as item 8, built after item 6 on its own stacked branch, feat/nf-8-observation-org. Turn this brief into a full plan with superpowers:writing-plans first, and add item 8 to the 2026-11-15 checklist.

## The real export (verified 2026-11-15 from Koen's file)
A real export sits in the main checkout at /Users/yusuf/orca/projects/everybird/private/observation-org/ (git-ignored). It is personal data: read it for testing, never commit it or copy rows from it. Fixtures must be synthetic.

- File name: `observation-<YYYY-MM-DD-HH-MM>-species_observed_<user>.csv`. This is observation.org's "Observed species" (life list) export, not a per-observation export.
- UTF-8, no BOM, comma-delimited, header row, LF. Dates ISO `YYYY-MM-DD`.
- Columns: `name,scientific name,group,date first observed,date last observed,number of observations,number of individuals,number of photos,number of sounds,species type`.
- `name` and `group` are in the user's site language (Dutch here: group `Vogels`). The header row stayed English. Don't rely on `name` or `group` text; match on `scientific name`.
- `species type` values seen (Dutch): `soort` (species), `ondersoort` (subspecies), `verzamelsoort` (aggregate, e.g. `Motacilla spec.`, `Monticola solitarius / saxatilis`), `hybride` (`A x B`), `synoniem` (synonym), `forma`, `variëteit`. Expect English values (species, subspecies, ...) for English-language accounts; handle both.
- No locations, so seen-here places are unknown: the Places filter has nothing for these birds (say so, like the eBird life-list note). The first-observed date is the lifer date.

## Matching results on the real file (954 rows)
- All 823 `soort` rows match `species.v1.json` exactly by scientific name (case-insensitive).
- 80 subspecies all reduce to species already listed (binomial). Count none twice.
- Synonyms: `Corvus cornix` is a full eBird species (Hooded Crow): count it. `Milvus aegyptius` is in eBird a group of Black Kite (`Milvus migrans`): map it there.
- Aggregates, hybrids, forma and variety: skip and list them in the match report, as the other imports do for slashes, spuhs and hybrids.
- Expected: 823 species, or 824 with Hooded Crow.

## Scope
- A third eBird-like file input on the landing and in Settings ("observation.org"), with a short how-to: on observation.org, open Observed species, choose Birds and Life list, then Export as CSV. Confirm the exact menu wording from the live site in the Orca browser before writing it.
- Also accept the XLSX export only if it is trivial; otherwise CSV only, and say so.
- Reuse the iNaturalist name pipeline (synonyms, regional splits) for names that don't match exactly.
- Merge with existing lists as the other sources do; the match report lists skipped rows.
- Match DESIGN.md; no new visual language.

## Additions from Yusuf (2026-11-15)

### Dutch as a third language
Add Dutch (nl) to the i18n item (1+7), on the same layer as Spanish and Brazilian Portuguese: UI strings, share images, link previews, About, errors and aria labels. Bird names come from eBird's Dutch common names (`nl_NL`), and search works in Dutch and English. Language picker, browser default and locale stamp work as for the other languages. If the i18n branch has already shipped by the time you read this, add Dutch as a follow-up on its own branch (feat/nf-1-7-nl) before item 8.

### Locations for observation.org birds
The "Observed species" export has no locations, so the Places filter knows nothing for these birds. Plan for both:
1. **Now:** the life-list CSV, with the same visible note as the eBird life-list import: Places only works with a per-observation export.
2. **Next:** observation.org's per-observation export (Observations → Export: CSV/XLSX), which should carry country and region per observation. Its format is not verified yet; Yusuf will ask Koen for a sample. Once it arrives (same private/observation-org/ folder), import it the way MyEBirdData.csv works: read country and province/state (and county where it maps) into seen-here, never location names or coordinates (privacy rule). Until a sample exists, don't guess its columns. Build (1) and leave a clean seam for (2).
