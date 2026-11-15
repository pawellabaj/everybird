// Dutch: standard Netherlands Dutch that reads naturally in Flanders, informal "je/jij" (never "u"), sentence case. GLOSSARY.md.
import type { Messages } from './en'

export const nl: Messages = {
  ui: {
    num: { group: '.', decimal: ',' },
    date: {
      months: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
      asOf: 'Per',
    },
    count: { label: 'soorten' },
    shell: {
      nav: {
        label: 'Everybird',
        collage: 'Collage',
        settings: 'Instellingen',
        about: 'Over',
      },
      darkMode: 'Donkere modus',
      footer: {
        credits: 'Alle credits',
        madeBy: 'Gemaakt door Yusuf Taleb',
        coffee: 'Trakteer me op koffie',
        github: 'Everybird op GitHub',
      },
    },
  },
  page: {},
}
