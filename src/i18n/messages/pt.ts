// Brazilian Portuguese: "você", sentence case. Portugal gets this UI with pt_PT bird names. GLOSSARY.md.
import type { Messages } from './en'

export const pt: Messages = {
  ui: {
    num: { group: '.', decimal: ',' },
    date: {
      months: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
      asOf: 'Em',
    },
    count: { label: 'espécies' },
    shell: {
      nav: {
        label: 'Everybird',
        collage: 'Colagem',
        settings: 'Ajustes',
        about: 'Sobre',
      },
      darkMode: 'Modo escuro',
      footer: {
        credits: 'Todos os créditos',
        madeBy: 'Feito por Yusuf Taleb',
        coffee: 'Me pague um café',
        github: 'Everybird no GitHub',
      },
    },
  },
  page: {},
}
