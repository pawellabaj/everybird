// Spanish: neutral (reads naturally in Spain and Latin America, no regional words), "tú", sentence case. GLOSSARY.md.
import type { Messages } from './en'

export const es: Messages = {
  ui: {
    num: { group: '.', decimal: ',' },
    date: {
      months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
      asOf: 'Al',
    },
    count: {
      label: 'especies',
      live: { one: '{n} especie', other: '{n} especies' },
    },
    shell: {
      nav: {
        label: 'Everybird',
        collage: 'Collage',
        settings: 'Ajustes',
        about: 'Acerca de',
      },
      darkMode: 'Modo oscuro',
      footer: {
        credits: 'Todos los créditos',
        madeBy: 'Hecho por Yusuf Taleb',
        coffee: 'Invítame a un café',
        github: 'Everybird en GitHub',
      },
      language: {
        button: 'Idioma: {name}',
        menu: 'Idioma',
      },
    },
    settings: {
      language: 'Idioma',
      enNames: {
        label: 'Mostrar los nombres de las aves en inglés',
        note: 'Donde aparezcan nombres de aves, en este dispositivo.',
      },
    },
  },
  page: {},
}
