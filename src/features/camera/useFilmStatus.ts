import { useEffect } from 'react';
import { usePlayer } from '../../store/player';
import { developAt, filmStand, useFilm } from '../../store/film';
import { useParty } from '../party/PartyContext';

export interface FilmStatus {
  /** Läuft gerade ein Abend? Ohne Abend gibt es keinen Film. */
  running: boolean;
  /** Bilder auf dem Film, insgesamt. */
  total: number;
  /** Wie viele davon noch frei sind. */
  remaining: number;
  /** Wie viele ICH davon noch belichten darf. */
  mineLeft: number;
  /** Wann die Bilder dieses Abends sichtbar werden. */
  developsAt: number;
  /** Eingestellte Wartezeit in Stunden, 0 = am nächsten Morgen. */
  developAfterH: number;
  /** Darf dieses Gerät die Einstellungen ändern? */
  canSetup: boolean;
}

/**
 * Der Stand des gemeinsamen Films.
 *
 * Die Zahl der GERÄTE ist der Teiler, nicht die der Spieler: auf einem
 * geteilten Handy wandert die Kamera herum wie eine echte, da ist nichts
 * aufzuteilen. Online meldet jedes Gerät nur, wie viele Bilder es selbst
 * verbraucht hat – über die Verbindung wandert eine Zahl, nie ein Bild.
 */
export function useFilmStatus(): FilmStatus {
  const party = useParty();
  const mine = useFilm((s) => s.mine);
  const rolls = useFilm((s) => s.rolls);
  const developAfterH = useFilm((s) => s.developAfterH);
  const nightStartedAt = usePlayer((s) => s.nightStartedAt);
  const usedHigh = useFilm((s) => s.usedHigh);
  const noteUsed = useFilm((s) => s.noteUsed);
  const setDevelopAfterH = useFilm((s) => s.setDevelopAfterH);
  const setRolls = useFilm((s) => s.setRolls);

  const online = party.mode === 'online';
  // Online gilt, was der Host für die Runde gesetzt hat – sonst entwickelten
  // die Bilder eines Abends auf jedem Telefon zu einer anderen Zeit.
  const effRolls = online ? (party.film?.rolls ?? 1) : rolls;
  const effDevelop = online ? (party.film?.developAfterH ?? 0) : developAfterH;
  const { total, remaining, mineLeft, used } = filmStand({
    online,
    othersShots: party.players.filter((p) => p.id !== party.me.id).map((p) => p.shots ?? 0),
    mine,
    rolls: effRolls,
    usedHigh,
  });

  // Höchststand fortschreiben und die Runden-Einstellung lokal spiegeln:
  // bricht die Verbindung weg, gilt sonst wieder die Voreinstellung, und
  // schon geschossene Bilder eines Abends entwickelten zu anderen Zeiten.
  useEffect(() => {
    noteUsed(used);
    if (party.film && party.film.developAfterH !== developAfterH) {
      setDevelopAfterH(party.film.developAfterH);
    }
    if (party.film && party.film.rolls !== rolls) setRolls(party.film.rolls);
  }, [used, noteUsed, party.film, developAfterH, rolls, setDevelopAfterH, setRolls]);

  return {
    running: nightStartedAt !== null,
    total,
    remaining,
    mineLeft,
    developsAt: developAt(nightStartedAt ?? Date.now(), effDevelop),
    developAfterH: effDevelop,
    canSetup: !online || party.isHost,
  };
}
