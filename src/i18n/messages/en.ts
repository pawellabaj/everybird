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
  /** Dates: the 12 short months, January first (= src/lib/format.ts MONTHS), the share images' date stamp too ("14 Nov 2026", no lead). */
  date: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
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
    /** "See my collage", after the summary line once an import landed. */
    seeCollage: 'See my collage',
    /** Your data (SettingsPage, RestoreBackup). */
    data: {
      head: 'Your data',
      noteMine: 'Your list lives on this device. Download it, or move it to another device with the backup.',
      noteRestore: 'Moving from another device? Restore the backup you downloaded there.',
      /** Name your collage (NameField). */
      name: {
        label: 'Name your collage',
        placeholder: 'e.g. Yusuf’s life list',
        helper: 'Shown as your collage’s title and on shares.',
      },
      downloadCsv: 'Download CSV',
      downloadJson: 'Download JSON backup',
      restore: 'Restore from backup',
      forget: 'Forget my list',
      restoreAsk: 'Replace your list with this backup? Download your current list first if you want to keep it.',
      restoreYes: 'Yes, replace it',
      restoreKeep: 'Keep my list',
      forgetAsk: 'Forget this list on this device? Download a backup first if you want to keep it.',
      forgetYes: 'Yes, forget it',
      forgetKeep: 'Keep it',
      /** A backup that couldn't be read: the lead, then why (fromJson's BackupError reason). English shows fromJson's
       *  own message as the reason, so its wording stays exactly as it was. */
      restoreFailed: "Couldn't restore this backup.",
      restoreWhy: {
        json: 'This file is not valid JSON.',
        notBackup: 'This is not an Everybird backup.',
        version: 'Unsupported backup version.',
        damaged: 'Parts of this backup are damaged.',
      },
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
  /** The share dialog (ShareDialog), the share images' words (image.ts) and the link preview's (og.ts, the image
   *  route). The credits (FOOTER_LINE, SHARE_CREDIT) and the download names stay English and are not here. */
  share: {
    title: 'Share your collage',
    /** The format control's group name and its three segments (their 9:16, 4:5, 1:1 hints are in code). */
    formats: 'Image format',
    format: { story: 'Story', post: 'Post', square: 'Square' },
    /** The preview image's alt text, per format. */
    preview: { story: 'Preview of the story image', post: 'Preview of the post image', square: 'Preview of the square image' },
    failed: "Couldn't make the image.",
    imageFailed: 'Couldn’t make the image. Try again.',
    linkFailed: 'Couldn’t make the link. Try again.',
    tooLarge: 'This list is too large for a link. Share the image instead.',
    nameLabel: 'Collage title',
    namePlaceholder: 'Optional, shown on the image',
    showLatest: 'Show latest lifer',
    shareImage: 'Share image',
    download: 'Download image',
    copyLink: 'Copy link',
    /** After a download; {file} is the file's name (everybird-story.png, English in every language). */
    saved: 'Saved {file}.',
    savedPost: 'Saved {file}. Post it from your photos or files.',
    /** Copy link's note: `copied`, then the level's reason when the list was too large for regions, then `dropped`
     *  (joined by a space in code). Copied by hand: the reason, `dropped`, then `copyThis`. */
    copied: 'Link copied.',
    level: {
      countries: 'Your list is large, so the link carries countries instead of regions.',
      dates: 'Your list is large, so the link carries dates but no places.',
      species: 'Your list is large, so the link carries the species only, without dates or places.',
    },
    dropped: { one: '{n} bird is too new for links and left out.', other: '{n} birds are too new for links and left out.' },
    copyThis: 'Copy this link:',
    /** The hand-copy field's aria-label. */
    linkField: 'Share link',
    filtered: 'The image shows the current filter.',
    /** The latest lifer row's mono label on the images and the link preview ("LATEST LIFER · SEP 2026"; upper-cased in code). */
    latestLifer: 'Latest lifer',
    /** A link made before titles carries a bare name: its title (og.ts shareTitle). */
    oldLinkTitle: "{name}'s life list",
    /** The shared page's document title for a link without a title ({n} formatted). */
    untitledTitle: { one: 'A life list: {n} species', other: 'A life list: {n} species' },
  },
  /** Settings > Your list (ImportPanel, SourceLine, SourceMenu, EbirdDrop, InatForm, NotCounted, MatchReport,
   *  SpeciesSearch, source-counts.ts) and the import jobs' messages (use-import-jobs.ts). eBird, MyEBirdData and
   *  iNaturalist are names and stay as they are. */
  import: {
    head: 'Your list',
    combine: 'Combine any of these into one list.',
    privacy: 'Your list never leaves your browser. We count visits anonymously.',
    /** The eBird rows' group (its aria-label). */
    ebirdGroup: 'eBird files',
    /** The summary line ("Your collage has 199 species: 185 from eBird, 11 more from iNaturalist, 3 ticked by hand.").
     *  `head` is plural on the total, each part on its own number; the parts are joined with ", " in code. */
    summary: {
      head: { one: 'Your collage has {n} species', other: 'Your collage has {n} species' },
      list: '{head}: {parts}.',
      /** One source, plural on the total: "Your collage has 576 species, all from iNaturalist." */
      one: '{head}, {all}.',
      all: {
        ebird: { one: 'all from eBird', other: 'all from eBird' },
        inat: { one: 'all from iNaturalist', other: 'all from iNaturalist' },
        manual: { one: 'all ticked by hand', other: 'all ticked by hand' },
      },
      /** The first part. */
      first: {
        ebird: { one: '{n} from eBird', other: '{n} from eBird' },
        inat: { one: '{n} from iNaturalist', other: '{n} from iNaturalist' },
        manual: { one: '{n} ticked by hand', other: '{n} ticked by hand' },
      },
      /** A later part: the species it adds to the ones before (eBird is always first when it is on the list). */
      more: {
        inat: { one: '{n} more from iNaturalist', other: '{n} more from iNaturalist' },
        manual: { one: '{n} ticked by hand', other: '{n} ticked by hand' },
      },
    },
    /** A row's counts (countParts): "185 species · 12 only here". */
    species: { one: '{n} species', other: '{n} species' },
    onlyHere: '{n} only here',
    onlyEbird: '{n} only in eBird',
    /** "· 10 skipped why?" (SourceRow): the entries that weren't counted, and the button that says why. */
    skipped: { one: '{n} skipped', other: '{n} skipped' },
    why: 'why?',
    whyLabel: { one: 'Why {n} skipped?', other: 'Why {n} skipped?' },
    /** A row's status. */
    notAdded: 'Not added',
    noneYet: 'None yet',
    detailsUnknown: 'Details unknown',
    usernameUnknown: 'Username unknown: enter it again to refresh',
    imported: 'Imported {date}',
    updated: 'Updated {date}',
    /** The row's buttons and its ⋯ menu ({title} is the source's name). */
    add: 'Add',
    addLabel: 'Add {title}',
    replace: 'Replace',
    replaceLabel: 'Replace {name}',
    more: 'More for {title}',
    remove: 'Remove',
    /** Remove's one question; {what} is the row's `…What` below. */
    removeLabel: 'Remove {what}',
    removeAsk: 'Remove {what}? Its birds leave your collage unless another source has them. Your edits stay.',
    removeYes: 'Yes, remove it',
    keep: 'Keep it',
    /** The two eBird rows (EbirdDrop). */
    ebird: {
      listTitle: 'eBird life list',
      /** A file's name when it wasn't kept. */
      listFile: 'eBird life list download',
      fullFile: 'eBird full export',
      listWhat: 'your eBird life list download',
      fullWhat: 'your eBird full export',
      listGuide: 'Your World life list from eBird. It downloads at once, and places each bird to the state or province.',
      fullGuide: 'eBird’s full export of every checklist. It places birds down to the region (county), and joins your life list if you add both.',
      listHelp: "On eBird: My eBird, then your World life list total, then Download. It's instant, and places go down to the state or province.",
      fullHelp: 'On eBird: Download My Data (under My eBird). eBird emails you MyEBirdData.csv; it places birds down to the region (county).',
      choose: 'Choose your eBird file',
      drop: 'or drop it here',
      howTo: 'How do I get this file?',
      /** The hidden file input's aria-label. */
      input: 'eBird file',
      reading: 'Reading your file…',
      readingRows: { one: 'Reading your file… {n} row', other: 'Reading your file… {n} rows' },
      /** Under the rows with only the life list download; <link> opens MyEBirdData's Add panel. */
      liferNote: 'Your eBird life list only says where you first recorded each bird, so Places filters by those first places. <link>Add MyEBirdData</link> to filter by every place you recorded each bird, down to the county.',
      liferLink: 'Add MyEBirdData for every place',
      /** use-import-jobs.ts: a file that isn't an eBird export, and one that failed to read. */
      unknownFile: "Couldn't read this file. Use eBird's life list download or MyEBirdData.csv.",
      damaged: "Couldn't read this file. It may be damaged or not an eBird export.",
    },
    /** iNaturalist's row (InatForm). */
    inat: {
      what: 'your iNaturalist birds',
      refresh: 'Refresh',
      refreshLabel: 'Refresh {user} from iNaturalist',
      cancel: 'Cancel',
      change: 'Change username',
      guide: 'Your public, wild bird observations identified to species. iNaturalist sees the username; your list stays here.',
      guideReplaces: 'Fetching replaces only your iNaturalist birds. Your edits stay.',
      /** The field's label and placeholder. */
      username: 'iNaturalist username',
      fetch: 'Fetch my birds',
      keepUser: 'Keep {user}',
      howTo: 'How do I find my username?',
      help: 'Use your username (on your iNaturalist profile, after the @), not your display name. Only public, wild bird observations identified to species count.',
      fetched: 'Fetched {n} of {total}',
      lookingUp: 'Looking up “{user}”…',
      cancelled: 'Cancelled. Nothing was changed.',
      /** use-import-jobs.ts inatMessage, by the import's error code. */
      errors: {
        unknownUser: "We couldn't find an iNaturalist user called “{user}”. Check the username (not the display name).",
        noBirds: '“{user}” has no public bird observations on iNaturalist yet.',
        network: "Couldn't reach iNaturalist. Check your connection and try again.",
        rateLimited: 'iNaturalist is busy right now. Wait a minute, then try again.',
      },
    },
    /** What "why?" opens under a row (NotCounted). Plural on the entries or rows; the fix link is `collage.fix`. */
    notCounted: {
      groups: {
        one: "{n} entry isn't a species: birds only identified to a group (like “duck sp.”), either/or IDs (like “Greater/Lesser Scaup”) and hybrids. eBird leaves these off life lists too.",
        other: "{n} entries aren't species: birds only identified to a group (like “duck sp.”), either/or IDs (like “Greater/Lesser Scaup”) and hybrids. eBird leaves these off life lists too.",
      },
      unmatched: {
        one: "{n} row couldn't be matched to this year's eBird taxonomy.",
        other: "{n} rows couldn't be matched to this year's eBird taxonomy.",
      },
    },
    /** The match report (MatchReport, #match); its head is `collage.unmatched`, its button `collage.fix`. */
    match: {
      note: "Not in this year's eBird taxonomy, so not counted yet. Pick the right bird for each.",
      inatRow: 'iNaturalist observation {row}',
      listRow: 'eBird life list row {row}',
      ebirdRow: 'eBird row {row}',
      row: 'Row {row}',
      use: 'Use {name}',
      byHand: 'Fix by hand',
      find: 'Find the right species for {name}',
    },
    /** The species search (SpeciesSearch, and Tick by hand's field); its results' name is `collage.search.matches`. */
    search: {
      placeholder: 'Common or scientific name',
      none: "No bird by that name in eBird's taxonomy.",
    },
  },
  /** Tick by hand (ImportPanel's row, TickList). The removal toast is `collage.removed`. */
  tick: {
    title: 'Ticked by hand',
    button: 'Tick birds',
    /** The button's aria-label and the list's heading. */
    label: 'Tick birds off a list',
    search: 'Search birds',
    order: 'Order',
    allOrders: 'All orders',
    family: 'Family',
    allFamilies: 'All families',
    list: 'Species to tick',
    /** A row's name for screen readers when the bird is already on the list ({name} is "Common, Scientific"). */
    onListLabel: '{name}, already on your list',
    onList: 'On your list',
    toRemove: 'To remove',
    bar: 'Add or remove the ticked birds',
    selected: { one: '{n} selected', other: '{n} selected' },
    toRemoveN: { one: '{n} to remove', other: '{n} to remove' },
    date: 'Date (optional)',
    datePlaceholder: 'Date: YYYY-MM-DD, YYYY-MM or YYYY',
    dateError: 'Use YYYY-MM-DD, YYYY-MM or YYYY.',
    country: 'Country (optional)',
    noCountry: 'No country',
    region: 'Region (optional)',
    wholeCountry: 'Whole country',
    addN: { one: 'Add {n} to my list', other: 'Add {n} to my list' },
    removeN: { one: 'Remove {n} from my list', other: 'Remove {n} from my list' },
    keepThem: 'Keep them',
    added: { one: 'Added {n} bird to your list.', other: 'Added {n} birds to your list.' },
  },
  /** Settings > Counting (RulesSwitches). */
  rules: {
    head: 'Counting',
    note: 'Only full species count, as on eBird; subspecies roll up into their species.',
    heard: 'Hide heard-only birds',
    heardNote: '* Birds you only heard. {n} on your list.',
    dead: 'Hide found-dead birds',
    deadNote: '† Birds you found dead. {n} on your list.',
    research: 'Research-grade iNaturalist only',
    researchNote: {
      one: 'Count iNaturalist sightings only once the community agrees on the ID. Affects {n} bird.',
      other: 'Count iNaturalist sightings only once the community agrees on the ID. Affects {n} birds.',
    },
    researchOff: 'For iNaturalist sightings. Add iNaturalist above to use it.',
  },
  /** About's "How it works" figure (HowItWorksDemo): its sticker credit (<link> is huashu-bird-sticker's repo) and the caption that tells the same story in words ({total} is the demo's species count). The scene itself draws the product's own keys. */
  demo: {
    credit: 'Stickers: <link>huashu-bird-sticker</link>, CC BY 4.0',
    caption: 'An animation of Everybird at work: an eBird export file is dropped onto Settings, under Your list, and its rows are read; MyEBirdData is connected and the collage has {total} species, all from eBird. Then the collage builds, stickers arriving around the count as it rolls up to {total} species. Choosing the Herons order brings the six herons into the middle; All birds, in the breadcrumb, brings everyone back. Share opens the share dialog: the image, with the stickers around {total} species, the latest lifer and the footer line, in the Story, Post and Square formats.',
  },
}

const page = {
  /** Page metadata (title, description, Open Graph, Twitter) per language (generateMetadata under app/[lang]). Titles
   *  get " · Everybird" in code; the site's own title is just "Everybird". The shared view's are og.ts's, from `ui`. */
  meta: {
    description: 'Your life list as a sticker collage, from eBird, iNaturalist, or by hand.',
    about: {
      title: 'About',
      description: 'What Everybird is, how it works, what True size means, and the data, stickers, fonts and code it is built from.',
    },
    settings: { title: 'Settings' },
  },
  /** About (app/[lang]/(app)/about/page.tsx). `<tag>` words become links; proper names, licences and the Buy Me a Coffee button stay as they are. */
  about: {
    lede: "Everybird turns any birder's life list into a sticker collage.",
    what: { head: 'What it is', body: 'Your life list is already the record of a lifetime of birds. Everybird lays it out as one collage: every species a sticker, sized by its body mass, with the count in the middle. Filter it by group, place or year, then share it as an image or a link.' },
    how: {
      head: 'How it works',
      steps: [
        'Bring your list on <link>Settings</link>: an eBird file, an iNaturalist username, or birds ticked by hand. Combine them if you keep more than one record.',
        "Each bird is matched to this year's eBird taxonomy and keeps its earliest date. Rows that don't match are listed, so nothing is dropped quietly.",
        'The collage, the filters and the share images are all made in your browser.',
      ],
      privacy: "Your list never leaves your browser. We count visits with Cloudflare Web Analytics, anonymous and cookieless, and a few actions (a collage made, an image shared or saved, a link copied) with a small counter of our own that never sees your birds, names or places. A daily-changing anonymous id lets us count unique visitors without tracking anyone across days. Neither runs if your browser asks not to be tracked. Your language choice is kept in a small cookie on this device; it never leaves it except to show you the right page. The visit count includes your browser's language (just “es”, “pt” or “nl”).",
    },
    size: {
      head: 'What True size means',
      even: "Each sticker is sized from the bird's average body mass, from AVONET, by the area it covers on the page, so a peafowl's train or a heron's legs don't make it read small. The default evens sizes out: the area follows mass to the power of 0.4, so small birds stay visible next to big ones.",
      true: "True size uses the cube root of mass for length instead. Birds are roughly similar in density, so mass tracks volume, and its cube root tracks length: a bird eight times heavier is drawn about twice as long, covering four times the area. It's an estimate of relative size, not a measured length. Slim, long-necked birds can look a little small and chunky ones a little big, swimming poses hide part of the body, and each species uses one average mass, so males, females and seasons aren't told apart.",
    },
    credits: {
      head: 'Credits',
      madeBy: "Made by <you>Yusuf Taleb</you>. It grew out of the <life>life list on his site</life>, and is built from other people's generous work.",
      coffee: 'If you enjoy Everybird, you can buy Yusuf a coffee.',
      /** Each credit's mono label (its kind, then the licence). */
      label: {
        stickers: 'Stickers · CC BY 4.0',
        inspiration: 'Inspiration',
        taxonomy: 'Taxonomy',
        masses: 'Body masses · CC BY 4.0',
        api: 'API',
        countries: 'Country names · Public domain',
        regions: 'Region names · LGPL-2.1',
        fonts: 'Fonts · ITF Free Font License',
        mono: 'Font · OFL',
        flags: 'Flags · MIT',
        phosphor: 'Icons · MIT',
        icons8: 'Icons',
        code: 'Code · MIT',
      },
      stickers: { lead: 'Every bird sticker comes from huashu-bird-sticker by alchaincyf, licensed <cc>CC BY 4.0</cc>. The stickers were resized and trimmed for the web; nothing else was changed.', commit: 'Source commit <code>{sha}</code>.', tail: "About 2% of species don't have a sticker yet; they show as an outline, and new drawings arrive automatically as the sticker set grows." },
      inspiration: "Teddy Warner's Avian Visitors showed how lovely a wall of birds can be. Everybird started there.",
      taxonomyTitle: 'eBird and Clements',
      taxonomy: 'Bird names, species and their order follow the eBird/Clements taxonomy, version {version}, from the Cornell Lab of Ornithology. eBird files are read in your browser.',
      masses: "Sticker sizes use body masses from AVONET (Tobias et al. 2022, Ecology Letters), via huashu's species table.",
      api: "Observations come from iNaturalist's public API, called straight from your browser, about once a second.",
      countries: 'Country names and most region names come from Natural Earth.',
      regions: "The rest of the state and province names come from Debian's iso-codes ISO 3166-2 data, used for names only.",
      fonts: 'Satoshi and Cabinet Grotesk by Indian Type Foundry, served by Fontshare.',
      mono: 'Geist Mono by Vercel, under the SIL Open Font License.',
      flags: 'Country flags from flag-icons by Panayiotis Lipiridis, under the MIT licence.',
      phosphor: 'Icons from Phosphor Icons, under the MIT licence.',
      icons8: 'The site icon’s origami bird: <link>Origami</link> (Fluent Systems Regular) by Icons8.',
      code: "Everybird's code is open source under the <link>MIT licence</link>.",
    },
  },
}

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
