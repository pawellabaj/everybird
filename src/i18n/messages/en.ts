// English: the source of truth for every language. `Messages` is this file's shape, so es.ts, pt.ts and nl.ts fail
// `tsc` when a key is missing, and tests/i18n.test.ts fails when one is extra, empty or left in English.
//
// Values are plain data: strings with `{name}` variables and `<tag>chunk</tag>` markup (src/i18n/core.ts `fmt`,
// `rich`), `{ one, other }` plurals (`plural`) and arrays of strings. No functions, so `ui` can cross from a server
// layout to the client I18nProvider.
//
// `ui` is everything client code renders; `page` is server-only (About's prose, page metadata) and never reaches the
// provider. One key per area, in this order; a later task adds its area as a new key at the end of `ui` (collage,
// filters, card, landing, shared, places, settings, import, share, orders, ...) or of `page`, in all four files at once.
import type { Plural } from '../core'

const ui = {
  /** Number separators (src/i18n/format.ts): grouped from 4 digits. */
  num: { group: ',', decimal: '.' },
  /** Dates: the 12 short months, January first (= src/lib/format.ts MONTHS), and the share stamp's lead ("As of 14 Nov 2026"). */
  date: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    asOf: 'As of',
  },
  /** The count's label under the number (Tally, share images, link previews). At most 8 characters: the hole is sized for it. */
  count: {
    label: 'species',
    /** The settled count for screen readers (Tally's live region): "12 species". {n} is the formatted number. */
    live: { one: '{n} species', other: '{n} species' },
  },
  /** The top bar (TopBar, ThemeToggle) and the footer (SiteFooter) on every page. */
  shell: {
    nav: {
      /** The nav's aria-label. */
      label: 'Everybird',
      collage: 'Collage',
      settings: 'Settings',
      about: 'About',
    },
    /** The theme switch's aria-label. */
    darkMode: 'Dark mode',
    footer: {
      credits: 'All credits',
      madeBy: 'Made by Yusuf Taleb',
      coffee: 'Buy me a coffee',
      /** The GitHub link's aria-label. */
      github: 'Everybird on GitHub',
    },
    /** The top bar's language button (LanguageMenu, variant lang:a): its aria-label ({name} from LANG_NAMES) and its menu's. */
    language: {
      button: 'Language: {name}',
      menu: 'Language',
    },
  },
  /** Settings (SettingsPage). */
  settings: {
    /** Your data > the language select's label (LanguageField). */
    language: 'Language',
    /** Your data > the English-names switch (EnglishNamesSwitch), shown when the UI isn't English. */
    enNames: {
      label: 'Show bird names in English',
      note: 'Wherever bird names appear, on this device.',
    },
  },
  /** The collage page and the collage block every page shares (CollagePage, CollageView, ControlsBar, DockSearch,
   *  Collage's stage, Notices, UndoToast). The stats line and the Timeline readout join their parts with " · " in code. */
  collage: {
    /** The collage page's title when the collage has none (pageTitle). */
    untitled: 'My collage',
    addBirds: 'Add birds',
    share: 'Share',
    /** The collage block's accessible name: the birder's own, the landing sample, a shared link's. */
    regionYours: 'Your collage',
    regionSample: 'Sample collage',
    regionShared: 'Shared collage',
    /** Under the stats: rows no species matched, and the link to Settings' match report (joined by " · " in code). */
    unmatched: { one: "{n} row couldn't be matched", other: "{n} rows couldn't be matched" },
    fix: { one: 'Fix it', other: 'Fix them' },
    /** The stats line's parts ("197 species · 20 orders · 50 families · since Jan 2020"; filtered "12 of 197 species"). */
    stats: {
      species: { one: '{n} species', other: '{n} species' },
      /** Plural on {total}. */
      of: { one: '{n} of {total} species', other: '{n} of {total} species' },
      orders: { one: '{n} order', other: '{n} orders' },
      families: { one: '{n} family', other: '{n} families' },
      since: 'since {date}',
    },
    /** The stage's placeholder while the first layout is packed. */
    arranging: 'arranging the stickers',
    /** The legend under the collage (its parts joined by " · " in code). */
    legend: {
      latest: 'Latest: {name}',
      latestOn: 'Latest: {name}, <time>{date}</time>',
      sizesEven: 'Sizes follow body mass, evened out so small birds stay visible',
      sizesTrue: 'Sizes follow body mass at true scale',
      marks: '* heard only · † found dead',
    },
    /** The stage's accessible name. */
    stage: {
      even: {
        one: 'Collage of {n} species, sized by body mass. Use the arrow keys to move between birds.',
        other: 'Collage of {n} species, sized by body mass. Use the arrow keys to move between birds.',
      },
      trueScale: {
        one: 'Collage of {n} species, sized by body mass at true scale. Use the arrow keys to move between birds.',
        other: 'Collage of {n} species, sized by body mass at true scale. Use the arrow keys to move between birds.',
      },
    },
    /** The controls bar. `…Short` labels show on narrow bars; `…Sr` follows the label for screen readers only. */
    controls: {
      view: 'View',
      collage: 'Collage',
      list: 'List',
      heaviestFirst: 'Heaviest first',
      lightestFirst: 'Lightest first',
      heaviest: 'Heaviest',
      lightest: 'Lightest',
      sortedHeaviest: 'Sorted by body mass, heaviest first. Reverse order',
      sortedLightest: 'Sorted by body mass, lightest first. Reverse order',
      trueSize: 'True size',
      trueShort: 'True',
      trueSr: 'sticker sizes',
      trueTitle: 'Size by body mass at true scale (big birds dwarf small ones)',
      sci: 'Scientific',
      sciShort: 'Sci.',
      sciSr: 'names',
    },
    /** The dock search (DockSearch). */
    search: {
      find: 'Find a bird',
      close: 'Close search',
      results: 'Matching birds and groups',
      elsewhere: 'Elsewhere on the list',
      order: 'Order',
      family: 'Family',
      species: 'Species',
      noneYour: 'No bird on your list matches “{q}”.',
      noneThis: 'No bird on this list matches “{q}”.',
      matches: { one: '{n} match', other: '{n} matches' },
    },
    /** The close buttons' aria-label (the welcome, sheets, the Places and Time sheet). */
    close: 'Close',
    /** "Removed … · Undo" (UndoToast; Tick by hand uses it too). */
    undo: 'Undo',
    removed: { one: 'Removed {name}.', other: 'Removed {n} birds.' },
    /** Notices on every page of the app (Notices.tsx); `loadFailed` on a shared view too. */
    notices: {
      memory: "This list won't be saved on this device. Your browser is blocking storage (private browsing does this), so download a backup before you leave.",
      forgetFailed: "Couldn't clear this device's copy. Clear this site's data in your browser settings to remove it.",
      loadFailed: "Couldn't load the bird data. Check your connection and reload the page.",
    },
  },
  /** The taxonomy filter (FilterBar, LevelRow, SheetPicker, PickerSheet, Chip), the Places and Time buttons
   *  (FilterDropdowns, filter-summary.ts) and the Time panel (Timeline, timeline.ts). */
  filters: {
    label: 'Filters',
    nav: 'Filter by group',
    all: 'All birds',
    /** A level's mono label and its sheet's title. */
    rank: { order: 'Orders', family: 'Families', country: 'Countries', year: 'Years' },
    /** The phone's picker button. */
    choose: { order: 'Choose an order', family: 'Choose a family', country: 'Choose a country', year: 'Choose a year' },
    /** A removable chip's aria-label. */
    remove: 'Remove {label} filter',
    /** The two buttons in the controls bar and their group. */
    dock: 'Places and time',
    places: 'Places',
    time: 'Time',
    clear: 'Clear',
    timeline: {
      /** Full month names, January first (the sliders' value text, the Time button's spoken text). */
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      /** A month in full ("March 2020"). */
      month: '{month} {year}',
      /** A range, both months included ("Mar 2020 to Jun 2021"). */
      range: '{from} to {to}',
      from: 'From {month}',
      upTo: 'Up to {month}',
      /** The Time button's short summary ("Time · from 2022"). */
      sumFrom: 'from {year}',
      sumTo: 'to {year}',
      /** The Time button's spoken text. */
      spokenFrom: 'from {month}',
      spokenUpTo: 'up to {month}',
      start: 'Start month',
      end: 'End month',
      empty: 'This list has no dates, so there is no timeline.',
    },
  },
  /** The Places panel (PlacesList, PlacesDrill, PlacesTree, places-shared). Country names come from the data
   *  (src/lib/i18n-places.ts); province and county names are local names. */
  places: {
    head: { country: 'Countries', province: 'States and provinces', county: 'Counties' },
    find: { country: 'Find a country', province: 'Find a state or province', county: 'Find a county' },
    noMatch: { country: 'No country matches.', province: 'No state or province matches.', county: 'No county matches.' },
    allCountries: 'All countries',
    /** The drilled level's first row, the parent's own checkbox ("All of Canada"). */
    allOf: 'All of {place}',
    /** The drill buttons' aria-labels (design a). */
    drill: { country: 'Show states and provinces in {place}', province: 'Show counties in {place}' },
    /** The disclosure buttons' and open groups' names (design b). */
    group: { country: 'States and provinces in {place}', province: 'Counties in {place}' },
    none: 'No places on this list.',
    emptyFiltered: 'No places here under the other filters.',
    emptyNow: 'No places here on your list now.',
    /** The lifer-only note; <link> goes to Settings' MyEBirdData panel. */
    note: {
      add: 'Places only knows where you first recorded each bird. <link>Add MyEBirdData</link> to filter by every place you recorded each bird, down to the county.',
      reimport: 'Places only knows where you first recorded each bird. <link>Import MyEBirdData again</link> to filter by every place you recorded each bird.',
    },
    /** Three or more places on the share image ("Canada and 2 more"; two are joined by " + " in code). */
    andMore: '{first} and {n} more',
  },
  /** The bird card and the hover tooltip (BirdCard, BirdTip), the list view (ListView), the marks (Marks) and the
   *  card's edit actions (EditBird). */
  card: {
    close: 'Close',
    noDrawing: 'No drawing yet for this species.',
    assignedRegion: 'Assigned by region',
    assignedDefault: 'Assigned by default',
    mass: 'Average body mass',
    massFamily: 'Average body mass, estimated from its family',
    massOrder: 'Average body mass, estimated from its order',
    heard: 'Heard only',
    dead: 'Found dead',
    /** The list view's accessible name. */
    list: 'Life list',
    marks: 'Marks',
    markAs: 'Mark as',
    resetMarks: 'Marks from my records',
    remove: 'Remove from my list',
  },
  /** The landing page (Landing, SampleDemo) and the first visit's welcome (Welcome). */
  landing: {
    title: 'A lifetime of birds.',
    lede: 'Your life list as a sticker collage, from eBird, iNaturalist, or by hand.',
    makeYours: 'Make yours',
    samplePrefix: "Sample: a demo birder's life list",
    sampleFailed: "Couldn't load the sample collage. Check your connection and reload the page.",
    welcome: 'A lifetime of birds, as a sticker collage.',
    makeMine: 'Make mine',
    explore: 'Explore the sample',
  },
  /** The shared view's page (/s/[token]) and SharedView. A link's own title and the page metadata are og.ts's. */
  shared: {
    brokenTitle: "This link didn't open",
    brokenLede: "It may be cut off, or made by a newer Everybird. Everybird turns a birder's life list into a sticker collage.",
    lede: "Everybird turns a birder's life list into a sticker collage.",
    /** The h1 of a link without a title. */
    untitled: "A birder's life list",
    endCta: 'Your list, from eBird, iNaturalist or by hand, as a collage like this.',
    noPlacesDates: 'This link carries no places or dates, so those filters are left out.',
    noPlaces: 'This link carries no places, so those filters are left out.',
    noDates: 'This link carries no dates, so those filters are left out.',
  },
  /** Plain labels for the bird orders (scientific name -> label): every order in species.v1.json. English is a copy of
   *  src/lib/species/orders.ts ORDERS (tests/i18n.test.ts keeps them equal). */
  orders: {
    Struthioniformes: 'Ostriches',
    Casuariiformes: 'Cassowaries and emu',
    Apterygiformes: 'Kiwis',
    Rheiformes: 'Rheas',
    Tinamiformes: 'Tinamous',
    Anseriformes: 'Waterfowl',
    Galliformes: 'Gamebirds',
    Columbiformes: 'Pigeons and doves',
    Mesitornithiformes: 'Mesites',
    Pterocliformes: 'Sandgrouse',
    Otidiformes: 'Bustards',
    Musophagiformes: 'Turacos',
    Cuculiformes: 'Cuckoos',
    Caprimulgiformes: 'Nightjars',
    Nyctibiiformes: 'Potoos',
    Steatornithiformes: 'Oilbird',
    Podargiformes: 'Frogmouths',
    Aegotheliformes: 'Owlet-nightjars',
    Apodiformes: 'Swifts and hummingbirds',
    Gruiformes: 'Cranes and rails',
    Charadriiformes: 'Shorebirds and gulls',
    Phoenicopteriformes: 'Flamingos',
    Podicipediformes: 'Grebes',
    Opisthocomiformes: 'Hoatzin',
    Eurypygiformes: 'Kagu and sunbittern',
    Phaethontiformes: 'Tropicbirds',
    Gaviiformes: 'Loons',
    Sphenisciformes: 'Penguins',
    Procellariiformes: 'Albatrosses and petrels',
    Ciconiiformes: 'Storks',
    Suliformes: 'Cormorants',
    Pelecaniformes: 'Herons',
    Cathartiformes: 'New World vultures',
    Accipitriformes: 'Hawks and eagles',
    Strigiformes: 'Owls',
    Coliiformes: 'Mousebirds',
    Leptosomiformes: 'Cuckoo-roller',
    Trogoniformes: 'Trogons',
    Bucerotiformes: 'Hornbills and hoopoes',
    Coraciiformes: 'Kingfishers and bee-eaters',
    Piciformes: 'Woodpeckers',
    Cariamiformes: 'Seriemas',
    Falconiformes: 'Falcons',
    Psittaciformes: 'Parrots',
    Passeriformes: 'Perching birds',
  },
}

const page = {}

export const en = { ui, page }

/** English's client strings alone: the provider's fallback imports this, not `en`, so `page` stays off the client. */
export const EN_UI = ui

/** A messages type with its string literals widened: strings stay strings, plurals `Plural`, string arrays `readonly string[]`. */
export type Widen<T> = T extends string
  ? string
  : T extends readonly string[]
    ? readonly string[]
    : T extends Plural
      ? [Exclude<keyof T, keyof Plural>] extends [never]
        ? Plural
        : { [K in keyof T]: Widen<T[K]> }
      : { [K in keyof T]: Widen<T[K]> }

export type Messages = Widen<typeof en>
export type Ui = Messages['ui']
