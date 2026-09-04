import { useEffect, useState } from 'react';
import { getLoadedGame, loadGame } from './registry';
import type { GameDefinition } from './types';

/**
 * Die vollständige Spieldefinition für den Spielbildschirm. Liefert sofort,
 * was schon geladen ist, sonst `null`, bis der Chunk da ist. `error` wird
 * wahr, wenn der Chunk nicht kommt (kein Netz, alter Build) – dann braucht
 * die Oberfläche einen Ausweg statt eines ewigen Spinners.
 */
export function useLoadedGame(id: string | null): { def: GameDefinition | null; error: boolean } {
  const [def, setDef] = useState<GameDefinition | null>(() => (id ? getLoadedGame(id) : null));
  const [error, setError] = useState(false);
  useEffect(() => {
    setError(false);
    if (!id) {
      setDef(null);
      return;
    }
    let alive = true;
    setDef(getLoadedGame(id));
    loadGame(id)
      .then((d) => {
        if (alive) setDef(d);
      })
      .catch((e) => {
        console.error('Spiel konnte nicht geladen werden', e);
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [id]);
  return { def, error };
}
