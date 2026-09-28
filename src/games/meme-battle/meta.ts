import type { GameMeta } from '../types';
import image from '../../assets/games/meme-battle.webp';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik, Komponente und der Vorlagenkatalog lädt die Registry erst beim
 *  Spielstart; die Bilder selbst kommen einzeln aus `public/memes/`.
 *
 *  Die ID bleibt `meme-battle`: an ihr hängen Rundenzahl, Spicy-Schalter,
 *  eigene Themen und das Gedächtnis gesehener Karten auf allen Geräten. */
export const meta: GameMeta = {
  id: 'meme-battle',
  name: 'Meme-Duell',
  tagline: 'Vorlage ziehen, Text rein, abstimmen.',
  icon: 'quotes',
  accent: 'var(--mint)',
  image,
  minPlayers: 3,
  maxPlayers: 12,
  duration: '15-30 Min',
  intensity: 2,
  tags: ['kreativ', 'schnell', 'geheim'],
  requiresOwnDevice: true,
  allowSpicy: true,
  allowCustomCards: true,
  howTo: [
    'Jede Person braucht ein eigenes Handy. Alle bekommen eine Meme-Vorlage und schreiben ihre Texte hinein – die Uhr läuft. Passt die Vorlage nicht: neu würfeln (wie oft, stellt ihr vorher ein) oder zurück zur vorigen.',
    'Danach kommen die Memes einzeln und anonym auf alle Handys: Fire, OK oder Lame, dazu Reaktionen, die bei allen übers Bild fliegen. Einstimmig Fire bringt 1000 Punkte, jedes Lame zieht ab – auch ins Minus.',
    'Einmal pro Runde darfst du aufs Trittbrett eines fremden Memes springen: die Hälfte seiner Punkte geht an dich, das Meme bekommt +10 je Mitfahrer. Das schwächste Meme der Runde trinkt.',
    'Vier Modi: Klassisch, Gleiches Meme (alle dieselbe Vorlage), Themen (eigene Karten werden zu Themen) und Entspannt ohne Punkte. Am Ende: Podest und alle Memes von Fire bis Lame – antippen, groß ansehen, speichern.',
  ],
};
