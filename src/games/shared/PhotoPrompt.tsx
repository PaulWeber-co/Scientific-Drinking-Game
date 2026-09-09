import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';
import { usePlayer } from '../../store/player';
import { filmStand, useFilm } from '../../store/film';
import { useParty } from '../../features/party/PartyContext';

/** Nur bei jedem n-ten Spielende fragen – sonst wird die Nachfrage Möblierung. */
const EVERY = 3;

/**
 * Nachfrage nach einem Gruppenbild, wenn eine Partie zu Ende ist.
 *
 * Bewusst nicht nach jedem Spiel: eine Aufforderung, die immer kommt, wird
 * weggetippt, ohne gelesen zu werden. Und bewusst ohne Motivvorgabe aus
 * Trinkmengen – dazu steht in `GameOver.tsx`, warum.
 */
export function PhotoPrompt() {
  const nav = useNavigate();
  const party = useParty();
  const nightStartedAt = usePlayer((s) => s.nightStartedAt);
  const mine = useFilm((s) => s.mine);
  const rolls = useFilm((s) => s.rolls);
  const endings = useFilm((s) => s.endings);
  const usedHigh = useFilm((s) => s.usedHigh);
  const countEnding = useFilm((s) => s.countEnding);
  const [zeigen, setZeigen] = useState(false);

  // Einmal je Spielende zählen, nicht bei jedem Neuzeichnen.
  useEffect(() => {
    const nummer = countEnding();
    setZeigen(nummer % EVERY === 0);
    // Absichtlich ohne Abhängigkeiten: dieser Bildschirm erscheint einmal
    // pro Partie, und genau dann soll gezählt werden.
  }, [countEnding]);

  const { mineLeft } = filmStand({
    online: party.mode === 'online',
    othersShots: party.players.filter((p) => p.id !== party.me.id).map((p) => p.shots ?? 0),
    mine,
    rolls: party.film?.rolls ?? rolls,
    usedHigh,
  });

  if (!zeigen || !nightStartedAt || mineLeft <= 0 || endings === 0) return null;

  return (
    <div className="card stack-3">
      <div className="stack-2">
        <span className="t-headline">Gruppenbild?</span>
        <span className="t-caption">
          Ihr seht es erst morgen – wie bei einer Einwegkamera.
        </span>
      </div>
      <button
        className="btn btn--glass btn--block"
        onClick={() => {
          haptic('select');
          nav('/kamera');
        }}
      >
        <Icon name="camera" size={18} /> Foto machen
      </button>
    </div>
  );
}
