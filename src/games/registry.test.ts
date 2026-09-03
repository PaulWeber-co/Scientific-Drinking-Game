import { describe, expect, it } from 'vitest';
import { GAMES, getGame, getLoadedGame, loadGame } from './registry';

describe('Registry: Metadaten statisch, Module nachgeladen', () => {
  it('kennt jedes Spiel ohne sein Modul', () => {
    for (const g of GAMES) expect(getGame(g.id)).toBe(g);
    expect(getGame('gibt-es-nicht')).toBeNull();
  });

  it('lädt jedes Spiel nach, und die Definition passt zu ihren Stammdaten', async () => {
    for (const g of GAMES) {
      const def = await loadGame(g.id);
      // Die Kartenfabrik reicht bei `modes` nur id und label weiter.
      const { modes, ...rest } = g;
      expect(def).toMatchObject(rest);
      expect(def.modes?.map((m) => m.id)).toEqual(modes?.map((m) => m.id));
      expect(typeof def.createState).toBe('function');
      expect(typeof def.reduce).toBe('function');
      expect(def.Component).toBeTruthy();
      expect(getLoadedGame(g.id)).toBe(def);
    }
  });

  it('liefert für dieselbe Kennung dasselbe Modul', async () => {
    const [a, b] = await Promise.all([loadGame('maexchen'), loadGame('maexchen')]);
    expect(a).toBe(b);
  });

  it('lehnt unbekannte Kennungen ab', async () => {
    await expect(loadGame('gibt-es-nicht')).rejects.toThrow(/Unbekanntes Spiel/);
  });
});
