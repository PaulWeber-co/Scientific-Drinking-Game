import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { isNativeApp } from '../../lib/platform';
import { useApp } from '../../store/app';
import { useParty } from './PartyContext';

/**
 * Nach einem Neustart der App zurück in die Online-Runde.
 *
 * Android beendet Apps im Hintergrund, sobald es Speicher braucht – etwa
 * während der Host den Lobby-Code per Messenger verschickt. Danach startet die
 * App kalt auf der Spielewand, und die Runde wäre ohne ihren Host. Wer sie
 * nicht über „Verlassen" verlassen hat, kommt darum beim nächsten Start von
 * selbst wieder hinein (dieselbe Geräte-ID, also auch wieder als Host).
 *
 * Nur in der App: Im Browser schließt man einen Tab meist mit Absicht, und
 * dort bleibt „Zurück in Lobby …" im Runde-Tab.
 */
export function ResumeOnlineRound() {
  const party = useParty();
  const navigate = useNavigate();
  const lastCode = useApp((s) => s.lastLobbyCode);
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    if (!isNativeApp() || !lastCode || party.mode !== 'local') return;
    party
      .joinOnline(lastCode)
      .then(() => navigate('/lobby'))
      // Abgelaufen oder geschlossen: Der Fehler steht im Runde-Tab, wie bei
      // einem Tipp auf „Zurück in Lobby …".
      .catch(() => {});
    // Nur beim Start – nicht bei jedem späteren Wechsel von Modus oder Code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
