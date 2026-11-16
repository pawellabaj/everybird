import { EN_UI, type Ui } from '@/i18n/messages/en'

/** Plain-English labels for bird orders (scientific name -> label). Covers every order in species.v1.json. The UI's
 *  labels are `ui.orders` in each strings file (English's is a copy of this, tests/i18n.test.ts). */
export const ORDERS: Record<string, string> = {
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
}

/** Label for an order in the UI language (`t.orders`), else the English label, else the scientific name. `t` defaults
 *  to English for callers not yet translated (Tick by hand, Task 5). */
export function orderLabel(ord: string, t: Ui = EN_UI): string {
  return (t.orders as Record<string, string>)[ord] ?? ORDERS[ord] ?? ord
}
