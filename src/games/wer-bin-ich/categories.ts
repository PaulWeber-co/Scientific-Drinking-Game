import type { SpicyItem } from '../shared/prompts';

export interface Category extends SpicyItem {
  text: string;
}

/**
 * Kategorien für „Wer bin ich". Die Runde bekommt EINE davon, und jede Person
 * denkt sich für ihr Gegenüber einen Begriff daraus aus. Eine Vorschlagsliste
 * mit fertigen Begriffen gibt es bewusst nicht – die lernt man auswendig.
 *
 * Die Kategorie soll eingrenzen, nicht festlegen: Unter „Jemand mit
 * Schnurrbart" passen Promis, Serienfiguren und Comichelden gleichermaßen.
 *
 * Die Liste ist auf allen Geräten gleich, deshalb reisen Indizes. Eigene
 * Kategorien aus dem Spieldetail reisen als Text (siehe `customCats`).
 */
export const CATEGORIES: Category[] = [
  // Menschen
  { text: 'Promi' },
  { text: 'Deutscher Promi' },
  { text: 'Musiker oder Musikerin' },
  { text: 'Sportler oder Sportlerin' },
  { text: 'Schauspieler oder Schauspielerin' },
  { text: 'Historische Person' },
  { text: 'Jemand aus dem Fernsehen' },
  { text: 'Influencer oder YouTuber' },
  { text: 'Promi über 60' },
  { text: 'Jemand, der schon tot ist' },
  { text: 'Politiker oder Politikerin' },
  { text: 'Jemand aus der Königsfamilie' },

  // Figuren
  { text: 'Serienfigur' },
  { text: 'Filmfigur' },
  { text: 'Zeichentrickfigur' },
  { text: 'Disney-Figur' },
  { text: 'Videospielfigur' },
  { text: 'Superheld oder Bösewicht' },
  { text: 'Filmbösewicht' },
  { text: 'Märchenfigur' },
  { text: 'Figur aus einem Buch' },
  { text: 'Figur aus der Kindheit' },
  { text: 'Werbefigur oder Maskottchen' },
  { text: 'Figur aus einem Animationsfilm' },

  // Eigenschaften
  { text: 'Jemand mit Schnurrbart' },
  { text: 'Jemand mit Brille' },
  { text: 'Jemand, der Anzug trägt' },
  { text: 'Jemand mit Glatze' },
  { text: 'Jemand mit roten Haaren' },
  { text: 'Jemand mit Hut' },
  { text: 'Jemand mit Uniform' },
  { text: 'Etwas sehr Kleines' },
  { text: 'Etwas sehr Großes' },
  { text: 'Etwas, das fliegen kann' },
  { text: 'Etwas, das grün ist' },
  { text: 'Etwas, das Angst macht' },
  { text: 'Etwas mit Flügeln' },
  { text: 'Jemand mit Superkräften' },
  { text: 'Jemand, der immer schlecht gelaunt ist' },
  { text: 'Figur, die nie spricht' },

  // Tiere und Dinge
  { text: 'Tier' },
  { text: 'Tier aus dem Zoo' },
  { text: 'Haustier' },
  { text: 'Tier im Meer' },
  { text: 'Insekt oder Krabbeltier' },
  { text: 'Fabelwesen' },
  { text: 'Essen oder Getränk' },
  { text: 'Etwas aus der Küche' },
  { text: 'Gegenstand im Badezimmer' },
  { text: 'Fahrzeug' },
  { text: 'Beruf' },
  { text: 'Sportart' },
  { text: 'Musikinstrument' },
  { text: 'Etwas aus dem Weltall' },
  { text: 'Bauwerk oder Sehenswürdigkeit' },
  { text: 'Land oder Stadt' },
  { text: 'Marke oder Firma' },
  { text: 'App oder Website' },
  { text: 'Spielzeug' },
  { text: 'Etwas, das man auf einer Party findet' },

  // Spicy – nur im Stapel, wenn der Schalter an ist.
  { text: 'Sexsymbol', spicy: true },
  { text: 'Jemand mit Skandal', spicy: true },
  { text: 'Promi-Paar, das sich getrennt hat', spicy: true },
  { text: 'Reality-TV-Star', spicy: true },
  { text: 'Figur, in die man heimlich verknallt war', spicy: true },
  { text: 'Etwas, das man nicht den Eltern zeigt', spicy: true },
  { text: 'Jemand, mit dem man nie ein Date hätte', spicy: true },
  { text: 'Etwas aus dem Nachtleben', spicy: true },
];
