import type { SpicyItem } from '../shared/prompts';

export type CategoryGroup = 'Menschen' | 'Figuren' | 'Eigenschaften' | 'Dinge';

export interface Category extends SpicyItem {
  text: string;
  /** Abschnitt in der Auswahlliste. */
  group: CategoryGroup;
}

/**
 * Kategorien für „Wer bin ich". Die Runde bekommt EINE davon, und jede Person
 * denkt sich für ihr Gegenüber einen Begriff daraus aus. Eine Vorschlagsliste
 * mit fertigen Begriffen gibt es bewusst nicht – die lernt man auswendig. Wer
 * keine Idee hat, bekommt per „Idee" EINEN Vorschlag aus `pools.json`.
 *
 * Die Kategorie soll eingrenzen, nicht festlegen: Unter „Jemand mit
 * Schnurrbart" passen Promis, Serienfiguren und Comichelden gleichermaßen.
 *
 * Die Liste ist auf allen Geräten gleich, deshalb reisen Indizes. Eigene
 * Kategorien aus dem Spieldetail reisen als Text (siehe `customCats`).
 * Neue Kategorien nur ANHÄNGEN: Ein Gerät mit älterer App liest sonst unter
 * demselben Index eine andere Kategorie.
 */
export const CATEGORIES: Category[] = [
  // Menschen
  { text: 'Promi', group: 'Menschen' },
  { text: 'Deutscher Promi', group: 'Menschen' },
  { text: 'Musiker oder Musikerin', group: 'Menschen' },
  { text: 'Sportler oder Sportlerin', group: 'Menschen' },
  { text: 'Schauspieler oder Schauspielerin', group: 'Menschen' },
  { text: 'Historische Person', group: 'Menschen' },
  { text: 'Jemand aus dem Fernsehen', group: 'Menschen' },
  { text: 'Influencer oder YouTuber', group: 'Menschen' },
  { text: 'Promi über 60', group: 'Menschen' },
  { text: 'Jemand, der schon tot ist', group: 'Menschen' },
  { text: 'Politiker oder Politikerin', group: 'Menschen' },
  { text: 'Jemand aus der Königsfamilie', group: 'Menschen' },

  // Figuren
  { text: 'Serienfigur', group: 'Figuren' },
  { text: 'Filmfigur', group: 'Figuren' },
  { text: 'Zeichentrickfigur', group: 'Figuren' },
  { text: 'Disney-Figur', group: 'Figuren' },
  { text: 'Videospielfigur', group: 'Figuren' },
  { text: 'Superheld oder Bösewicht', group: 'Figuren' },
  { text: 'Filmbösewicht', group: 'Figuren' },
  { text: 'Märchenfigur', group: 'Figuren' },
  { text: 'Figur aus einem Buch', group: 'Figuren' },
  { text: 'Figur aus der Kindheit', group: 'Figuren' },
  { text: 'Werbefigur oder Maskottchen', group: 'Figuren' },
  { text: 'Figur aus einem Animationsfilm', group: 'Figuren' },

  // Eigenschaften
  { text: 'Jemand mit Schnurrbart', group: 'Eigenschaften' },
  { text: 'Jemand mit Brille', group: 'Eigenschaften' },
  { text: 'Jemand, der Anzug trägt', group: 'Eigenschaften' },
  { text: 'Jemand mit Glatze', group: 'Eigenschaften' },
  { text: 'Jemand mit roten Haaren', group: 'Eigenschaften' },
  { text: 'Jemand mit Hut', group: 'Eigenschaften' },
  { text: 'Jemand mit Uniform', group: 'Eigenschaften' },
  { text: 'Etwas sehr Kleines', group: 'Eigenschaften' },
  { text: 'Etwas sehr Großes', group: 'Eigenschaften' },
  { text: 'Etwas, das fliegen kann', group: 'Eigenschaften' },
  { text: 'Etwas, das grün ist', group: 'Eigenschaften' },
  { text: 'Etwas, das Angst macht', group: 'Eigenschaften' },
  { text: 'Etwas mit Flügeln', group: 'Eigenschaften' },
  { text: 'Jemand mit Superkräften', group: 'Eigenschaften' },
  { text: 'Jemand, der immer schlecht gelaunt ist', group: 'Eigenschaften' },
  { text: 'Figur, die nie spricht', group: 'Eigenschaften' },

  // Tiere und Dinge
  { text: 'Tier', group: 'Dinge' },
  { text: 'Tier aus dem Zoo', group: 'Dinge' },
  { text: 'Haustier', group: 'Dinge' },
  { text: 'Tier im Meer', group: 'Dinge' },
  { text: 'Insekt oder Krabbeltier', group: 'Dinge' },
  { text: 'Fabelwesen', group: 'Dinge' },
  { text: 'Essen oder Getränk', group: 'Dinge' },
  { text: 'Etwas aus der Küche', group: 'Dinge' },
  { text: 'Gegenstand im Badezimmer', group: 'Dinge' },
  { text: 'Fahrzeug', group: 'Dinge' },
  { text: 'Beruf', group: 'Dinge' },
  { text: 'Sportart', group: 'Dinge' },
  { text: 'Musikinstrument', group: 'Dinge' },
  { text: 'Etwas aus dem Weltall', group: 'Dinge' },
  { text: 'Bauwerk oder Sehenswürdigkeit', group: 'Dinge' },
  { text: 'Land oder Stadt', group: 'Dinge' },
  { text: 'Marke oder Firma', group: 'Dinge' },
  { text: 'App oder Website', group: 'Dinge' },
  { text: 'Spielzeug', group: 'Dinge' },
  { text: 'Etwas, das man auf einer Party findet', group: 'Dinge' },

  // Spicy – nur im Stapel, wenn der Schalter an ist.
  { text: 'Sexsymbol', group: 'Menschen', spicy: true },
  { text: 'Jemand mit Skandal', group: 'Menschen', spicy: true },
  { text: 'Promi-Paar, das sich getrennt hat', group: 'Menschen', spicy: true },
  { text: 'Reality-TV-Star', group: 'Menschen', spicy: true },
  { text: 'Figur, in die man heimlich verknallt war', group: 'Figuren', spicy: true },
  { text: 'Etwas, das man nicht den Eltern zeigt', group: 'Dinge', spicy: true },
  { text: 'Jemand, mit dem man nie ein Date hätte', group: 'Figuren', spicy: true },
  { text: 'Etwas aus dem Nachtleben', group: 'Dinge', spicy: true },

  // Ergänzt November 2026 – hinten angehängt, siehe oben.
  { text: 'Rapper oder Rapperin', group: 'Menschen' },
  { text: 'Comedian', group: 'Menschen' },
  { text: 'Moderator oder Moderatorin', group: 'Menschen' },
  { text: 'Fußballer oder Fußballerin', group: 'Menschen' },
  { text: 'Wissenschaftler oder Wissenschaftlerin', group: 'Menschen' },
  { text: 'Künstler oder Künstlerin', group: 'Menschen' },
  { text: 'Fernsehkoch oder Fernsehköchin', group: 'Menschen' },
  { text: 'Harry-Potter-Figur', group: 'Figuren' },
  { text: 'Star-Wars-Figur', group: 'Figuren' },
  { text: 'Simpsons-Figur', group: 'Figuren' },
  { text: 'Pokémon', group: 'Figuren' },
  { text: 'Anime-Figur', group: 'Figuren' },
  { text: 'Figur aus einer Kinderserie', group: 'Figuren' },
  { text: 'Sitcom-Figur', group: 'Figuren' },
  { text: 'Horrorfilm-Figur', group: 'Figuren' },
  { text: 'Roboter aus Film oder Serie', group: 'Figuren' },
  { text: 'Jemand mit Bart', group: 'Eigenschaften' },
  { text: 'Etwas, das rot ist', group: 'Eigenschaften' },
  { text: 'Etwas Rundes', group: 'Eigenschaften' },
  { text: 'Etwas, das Lärm macht', group: 'Eigenschaften' },
  { text: 'Vogel', group: 'Dinge' },
  { text: 'Obst oder Gemüse', group: 'Dinge' },
  { text: 'Süßigkeit', group: 'Dinge' },
  { text: 'Cocktail oder Drink', group: 'Dinge' },
  { text: 'Brettspiel oder Kartenspiel', group: 'Dinge' },
  { text: 'Kleidungsstück', group: 'Dinge' },
  { text: 'Automarke', group: 'Dinge' },
  { text: 'Hunderasse', group: 'Dinge' },
  { text: 'Figur aus einem Cartoon für Erwachsene', group: 'Figuren', spicy: true },
  { text: 'Etwas vom Junggesellenabschied', group: 'Dinge', spicy: true },
];
