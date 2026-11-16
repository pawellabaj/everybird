# Everybird next features (plan, 2026-11-15)

Decisions are Yusuf's unless marked *(builder's call)*. Each item is one branch and one review. Before building an item,
turn it into a step-by-step implementation plan (superpowers:writing-plans) next to this file, then tick it here when it
ships. Nothing here is started yet.

Order: 4 → 2 → 5 → 3 → 1+7 (with Dutch) → 6 → 8 (small and self-contained first; i18n touches every string, so it lands after the
share-image changes it has to translate; print reuses the finished share renderer).

## Checklist

- [ ] 1. Spanish
- [x] 2. Share dialog: "Show latest lifer" switch and Buy Me a Coffee (shipped on feat/nf-2-share-switch; plan 2026-11-15-2-share-switch.md)
- [x] 3. Conservation status (IUCN) (shipped on feat/nf-3-iucn; plan 2026-11-15-3-iucn-status.md; variants pill a/b and threat a/b/c kept for Yusuf; R2 data upload waits on credentials)
- [x] 4. Date stamp on share images (shipped on feat/nf-4-date-stamp; plan 2026-11-15-4-date-stamp.md)
- [x] 5. Smaller places (province/state, county) (shipped on feat/nf-5-places; plan 2026-11-15-5-smaller-places.md; Places variants a/b kept for Yusuf)
- [ ] 6. Print poster export (A1–A4)
- [ ] 7. Portuguese (Brazilian)
- [ ] 8. observation.org import (added 2026-11-15; brief `2026-11-15-8-observation-org-brief.md`; branch feat/nf-8-observation-org after item 6)

---

## 1. Spanish

- Everything: UI strings, share images (story, post, square), link previews (OG cards), About, errors, aria labels.
- Bird names: eBird's regional Spanish common names, picked from the browser locale and, where it helps, the list's
  country (e.g. es_MX, es_AR, es_CR, es_ES), falling back to general Spanish (es). English names stay available.
- Search matches both the Spanish and the English name.
- Language picker in Settings; default from the browser language; remembered locally. Share links carry no language:
  the viewer sees their own.
- Build the i18n layer so a new language is one strings file plus eBird's names for that locale (item 7 relies on this).
- Stats: add the browser language (primary subtag only, e.g. "es") to the visit event, to choose the next language.
  Candidates later: Thai (~10% of Thai visitors made a collage vs ~50% elsewhere, 2026-11-14/15), German, French.
- Dutch (nl) added 2026-11-15 (Yusuf, see the item 8 brief): built on the same layer as Spanish and Portuguese, in item 1+7. UI strings, share images, link previews, About, errors and aria labels; bird names from eBird `nl_NL`; search in Dutch and English; picker, browser default and the date stamp as for the other languages.
- Not now: Thai, German, French.

## 2. Share dialog: latest lifer switch and Buy Me a Coffee

- "Show latest lifer" switch in the share dialog, on by default. Off removes the latest-lifer line from the image.
- Buy Me a Coffee link, https://buymeacoffee.com/yusuftaleb, in the footer, on About, and in the share dialog.
  Never on the share images themselves. Quiet styling, no pop-ups or nags.

## 3. Conservation status (IUCN)

- Data: huashu-bird-sticker's `conservation.iucn` (BirdLife v10 via AviList, about 10.1k species), mapped to eBird codes
  through the existing sync. Species without a status show nothing.
- Filter: a "Status" dropdown next to Places and Time (multi-select: LC, NT, VU, EN, CR, EW, EX, DD).
- Bird card: under or near the weight, a small rounded pill with the abbreviation in Red List colours:
  LC green, NT yellow-green, VU yellow, EN orange, CR red, EW and EX dark purple or black, DD grey.
  Tap or hover shows the full name ("Vulnerable"). Text contrast must pass on every colour.
- A "threatened species" count (VU + EN + CR) where the list's totals are shown *(builder's call on exact placement)*.
- No marks on the collage or the share images.
- About gets a short data note: source, version, and that statuses are global, not regional.

## 4. Date stamp on share images

- Every share image (story, post, square) carries the date it was made: "As of 14 Nov 2026".
- Small and muted, in the footer next to the Everybird address. Always on, no switch.
- Localized with the UI language (Spanish "Al 14 nov 2026", Portuguese equivalent).
- Not on link previews (a link always shows the list as it was when shared).

## 5. Smaller places

Request: Biray Pınar (Instagram, 2026-11-15): "when I filter by country, it only shows species I saw there for the
first time … a filter by hotspot or smaller region would be great too."

- The Places filter drills down: country → province/state → county. Data is already there: seen-here stores sub1 and
  sub2 for MyEBirdData and iNaturalist records (`src/lib/list/seen.ts`). Filter keys extend the existing "c:CA" form
  *(builder's call on the exact key format)*. Chip counts and the map follow the selected level.
- Shared links keep the selected places.
- Make the lifer-only situation obvious: after an eBird life-list import (no seen-here), show a visible note that the
  Places filter only knows where each bird was first seen, with a one-tap path to import MyEBirdData.csv instead.
- Out of scope: hotspots. Location names are deliberately never read (privacy).

## 6. Print poster export

Request: Stefan Funk (email, 2026-11-15): a poster high-resolution enough to print on A2. Yusuf told him it is planned;
tell him when it ships.

- A "Print" option in the share dialog beside story, post and square.
- Sizes A1, A2, A3, A4, portrait, at 150 dpi (A2 2480 × 3508 px, A1 3508 × 4967 px). No 300 dpi option (decided
  2026-11-15: the stickers cap sharpness and phones can't hold the canvas).
- Output PNG and PDF.
- Stickers: add a print tier (about 1024 px) built from huashu's originals, uploaded to R2 beside the 128/384 tiers
  (e.g. `v1/1024/<code>.<sv>.webp`), loaded only when a print is made.
- A1 exceeds iOS Safari's canvas limit (about 16.7 MP): render in tiles or straight into the PDF so it works on phones.
- Render off the main thread with a progress indicator.
- Same layout as the share images, with the date stamp and "stickers by huashu" credit.

## 7. Portuguese (Brazilian)

- Same scope as Spanish (item 1), on the same i18n layer.
- Names: eBird pt_BR by default, pt_PT for visitors in Portugal; search in Portuguese and English.

## 8. observation.org import

Added 2026-11-15 (requested by Koen, an observation.org user; approved by Yusuf). Full brief: `2026-11-15-8-observation-org-brief.md`.

- Import observation.org's "Observed species" (life list) CSV as a third file source in Settings, matched on scientific name; subspecies reduce to their species; synonyms mapped (e.g. `Milvus aegyptius` → Black Kite); aggregates, hybrids, forma and variety skipped and listed in the match report.
- The first-observed date is the lifer date. No locations: the same visible note as the eBird life-list import (Places needs a per-observation export).
- Leave a clean seam for observation.org's per-observation export (country and region into seen-here) once Yusuf has a sample; don't guess its columns.
- XLSX only if trivial, otherwise CSV only. Synthetic fixtures only; the real export in `private/` is never committed.

## Hard rules for whoever builds this

- Ask Yusuf before pushing, deploying, posting or deleting.
- No personal data in commits; test fixtures are synthetic.
- Keep sticker credit ("stickers by huashu" on images, full credit on About).
- Don't borrow another species' drawing for a missing sticker.
