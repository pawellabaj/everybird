# Everybird glossary and translation rules

Read this before you translate a string or add a language. English (`messages/en.ts`) is the source of truth; every other `messages/<lang>.ts` has exactly its keys.

## Glossary

| English | es | pt | nl |
|---|---|---|---|
| life list | lista de vida | lista de vida | levenslijst |
| collage | collage | colagem | collage |
| sticker | sticker | adesivo | sticker |
| latest lifer | Última especie nueva | Última espécie nova | Nieuwste soort |
| species (count label) | especies | espécies | soorten |
| True size | Tamaño real | Tamanho real | Ware grootte |
| Scientific | Científico | Científico | Wetenschappelijk |
| Make yours | Haz el tuyo | Faça a sua (a colagem) | Maak de jouwe |
| Settings (top bar) | Ajustes | Ajustes | Instellingen |
| About (top bar) | Acerca de | Sobre | Over |
| My collage (untitled) | Mi collage | Minha colagem | Mijn collage |
| Places (filter) | Lugares | Lugares | Plaatsen |
| Time (filter) | Fechas | Datas | Tijd |
| county | condado | condado | graafschap |
| Heard only / Found dead | Solo oída / Encontrada muerta | Só ouvida / Encontrada morta | Alleen gehoord / Dood gevonden |
| birder | observador de aves | observador de aves | vogelaar |

## Register

- **Spanish (es):** neutral, reading naturally in Spain and Latin America. "Tú", never "vosotros" or "usted". No regional words: "dispositivo" (not "ordenador" or "computadora"), "archivo", "descargar", "compartir".
- **Portuguese (pt):** Brazilian Portuguese with "você". Visitors in Portugal get this UI with pt_PT bird names.
- **Dutch (nl):** standard Netherlands Dutch that reads naturally in Flanders. Informal "je/jij", never "u".
- **Every language** follows DESIGN.md "Voice and copy": plain words, second person, short sentences, sentence case (mono labels are uppercased by CSS, never in the string), no em dashes, no exclamation marks (nor "¡"), no emoji, no hype. Never "seen" for the list (heard-only birds count too): "on your list".

## Templates

- `{name}` is a variable: keep every one the English string has, spelled the same. You may move it.
- `<link>…</link>` (any `<tag>`) wraps words that become an element. Keep every tag; translate the words inside.
- Plurals are `{ one, other }`: `one` is used exactly when the number is 1, `other` for everything else (0 included). Write `{n}` where the number goes.
- Numbers and dates come from `ui.num` and `ui.date` through `src/i18n/format.ts`, never from `Intl` or `toLocaleString`.

## Stays English in every language

- The credit lines `FOOTER_LINE` ("everybird.yusuftaleb.com · stickers by huashu") and `SHARE_CREDIT` (attribution; only the date stamp after them is translated).
- CSV column headers and the CSV's English name column, download file names, the backup JSON, stored data (`titleFromOldName`'s output), analytics values.
- Scientific names, IUCN abbreviations (LC … DD; their full names are translated), province and county names.
- Names: Everybird, eBird, iNaturalist, GitHub, CSV, JSON. These may equal English; `ALLOW_SAME` in `tests/i18n.test.ts` lists every value allowed to.

Country names come from `Intl.DisplayNames` (the one `Intl` exception), bird and family names from eBird's localized taxonomy (the names files).

## How to add a language

1. `src/i18n/langs.ts`: add the code to `LANGS`, and its entries to `HTML_LANG` and `LANG_NAMES` (the name in its own language).
2. `src/i18n/messages/<lang>.ts`: `export const <lang>: Messages = { … }`, every key of `en.ts` translated with this glossary (add the new column above). `npx tsc --noEmit` names any missing key; `tests/i18n.test.ts` names extra, empty or untranslated ones. Add it to `MESSAGES` in `tests/i18n-render.tsx`.
3. The count label must be at most 8 characters (`COUNT_LABEL_CHARS`), and the group separator no wider than ",".
4. A rewrite regex for the language in `routes.ts`, so `/about` reaches `/<lang>/about` from the cookie or `Accept-Language`.
5. eBird's locales for its bird names in `NAME_LOCALES` (the names build), with their regional fallbacks.
