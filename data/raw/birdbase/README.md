# BIRDBASE body masses (extract)

**Source.** Şekercioğlu, Ç. H., et al. (2025). BIRDBASE: A global database of avian biogeography, conservation, ecology and life history traits. *Scientific Data*. doi [10.1038/s41597-025-05615-3](https://doi.org/10.1038/s41597-025-05615-3). Dataset on Figshare: doi [10.6084/m9.figshare.27051040.v1](https://doi.org/10.6084/m9.figshare.27051040.v1), file "BIRDBASE v2025.1 Sekercioglu et al. Final.xlsx" (md5 `36d53d59af1e449db1fc4c30062d9d1f`, published 2025-10-01).

**Licence.** CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Credited on Everybird's About page ("Body masses").

**Retrieved.** 2026-11-16, from Figshare. Checked live the same day against the Figshare API's licence field.

**What is here.** `birdbase-mass.csv`: the Data sheet's rows that have an Average Mass (10,582 of 11,589), in sheet order. Columns: `species_id` (BIRDBASE's), `english_name`, the five name columns the matcher reads (`latin_birdlife_first`: the workbook's own "Latin (BirdLife > IOC > Clements>AviList)" column; `hbw_birdlife`; `ioc_15_1`; `ebird_clements_2024b`; `avilist_v1_2025`) and `average_mass_g` (grams, as the workbook gives them: the mean of the sex-specific values; the Legend does not state the unit). Nothing else from the workbook is copied.

**Regenerate.** The xlsx is not committed. Put it in this folder (`*.xlsx` is git-ignored here) or anywhere, then:

    uv run --with openpyxl python -I scripts/build-data/birdbase-extract.py <BIRDBASE.xlsx>

The output is deterministic. The script warns if the file's md5 is not the one above.

**Use.** `scripts/build-data/birdbase.ts` matches each species that has no override or AVONET mass: scientific name against the five name columns in that order, then English name, case-insensitive. The first column with a row decides. Used by `build-species.ts` (`gSrc: 'birdbase'`).

**Caveats.** Name-only matching. Some names are lumped or reused across taxonomies and were not checked row by row. Extinct species are in BIRDBASE too. Values agree closely with AVONET where both exist (median ratio 1.00), probably partly from shared sources.
