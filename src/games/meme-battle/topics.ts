import type { SpicyItem } from '../shared/prompts';

export interface Topic extends SpicyItem {
  text: string;
}

/**
 * Themen für den Modus „Themen": die Runde bekommt eine Überschrift, jede
 * Person baut darauf ihr eigenes Meme. Kurz halten – das Thema steht über
 * dem Abzug und soll mit einem Blick gelesen sein.
 *
 * Die Liste ist auf allen Geräten gleich, deshalb reisen Indizes. Eigene
 * Themen aus dem Spieldetail reisen als Text (siehe `customTopics`).
 */
export const TOPICS: Topic[] = [
  { text: 'Montagmorgen' },
  { text: 'Die erste Stunde dieser Party' },
  { text: 'Wenn die Musik plötzlich ausgeht' },
  { text: 'Der Kater morgen früh' },
  { text: 'WG-Leben' },
  { text: 'Gruppenchat um 3 Uhr nachts' },
  { text: 'Wenn jemand „nur noch einen" sagt' },
  { text: 'Die Person, die immer zu spät kommt' },
  { text: 'Beim Vorglühen' },
  { text: 'Der letzte Döner der Nacht' },
  { text: 'Wenn der Akku bei 1 % ist' },
  { text: 'Familienfeier' },
  { text: 'Prüfungsphase' },
  { text: 'Homeoffice' },
  { text: 'Die Deutsche Bahn' },
  { text: 'Urlaub mit Freunden' },
  { text: 'Im Club, wenn das Lied kommt' },
  { text: 'Die Schlange vor der Toilette' },
  { text: 'Wenn die Pizza endlich kommt' },
  { text: 'Sport ab morgen, versprochen' },
  { text: 'Der Nachbar klopft wegen der Lautstärke' },
  { text: 'Wenn man den Namen vergessen hat' },
  { text: 'Taxi oder doch noch laufen?' },
  { text: 'Der Wecker am Sonntag' },
  { text: 'Wer hat das Bier im Gefrierfach vergessen?' },
  { text: 'Erwachsen sein' },
  { text: 'Steuererklärung' },
  { text: 'Beim Zahnarzt' },
  { text: 'Wenn Mama „Wir müssen reden" schreibt' },
  { text: 'Autokorrektur' },
  { text: 'Der eine Freund mit Beziehungsstatus „kompliziert"' },
  { text: 'Wenn jemand die Aux-Box übernimmt' },
  { text: 'Das Gruppenfoto' },
  { text: 'Dieses Spiel hier' },
  { text: 'Die Stimmung jetzt gerade' },
  { text: 'Wenn das WLAN weg ist' },
  { text: 'Online-Shopping um Mitternacht' },
  { text: 'Der Chef ruft am Freitag um 17 Uhr an' },
  { text: 'Nüchtern auf einer Party' },
  { text: 'Wenn jemand ein Geheimnis ausplaudert' },
  { text: 'Spieleabend' },
  { text: 'Der Kühlschrank um 3 Uhr nachts' },
  { text: 'Neujahrsvorsätze' },
  { text: 'Wenn die Pflanze wieder stirbt' },
  { text: 'Festival-Camping' },
  { text: 'Die Aliens beobachten uns' },

  // Spicy – nur im Stapel, wenn der Schalter an ist.
  { text: 'Das erste Date', spicy: true },
  { text: 'Tinder um 2 Uhr nachts', spicy: true },
  { text: 'Die Nachricht an den Ex', spicy: true },
  { text: 'Der Walk of Shame', spicy: true },
  { text: 'Rote Flaggen, die man ignoriert', spicy: true },
  { text: 'Wenn die Eltern früher heimkommen', spicy: true },
  { text: 'Der Anmachspruch, der schiefging', spicy: true },
  { text: 'Die Dating-Bio, ganz ehrlich', spicy: true },
];
