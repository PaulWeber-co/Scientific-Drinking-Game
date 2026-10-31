import { describe, expect, it } from 'vitest';
import { GAMES, gamesForGroup, getGame, getLoadedGame, loadGame, visibleGames } from './registry';

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

describe('Registry: Farbraum und Lebenszeichen', () => {
  // Der Farbraum trägt hellen Text (Titel, Chips): ein heller Ton dort wäre
  // unlesbar. Lebenszeichen liegen als Anteil im Bild, sonst sitzt die Lampe
  // neben dem Foto.
  it('gibt jedem Spiel einen dunklen Farbraum und ein Lebenszeichen im Bild', () => {
    expect(GAMES.length).toBeGreaterThanOrEqual(20);
    for (const g of GAMES) {
      expect(g.world, g.id).toMatch(/^#[0-9a-f]{6}$/i);
      const [r, gr, b] = [1, 3, 5].map((i) => parseInt(g.world.slice(i, i + 2), 16));
      expect(0.2126 * r + 0.7152 * gr + 0.0722 * b, g.id).toBeLessThan(60);
      expect(g.ambient, g.id).toBeDefined();
      for (const v of [g.ambient!.x, g.ambient!.y]) {
        expect(v, g.id).toBeGreaterThanOrEqual(0);
        expect(v, g.id).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('Ausgeblendete Spiele', () => {
  const versteckt = GAMES.filter((g) => g.hidden).map((g) => g.id);

  it('blendet genau die drei unreifen Spiele aus', () => {
    expect(versteckt.sort()).toEqual(['chaos-roulette', 'schaetzfrage', 'tabu']);
  });

  it('bietet sie keiner Runde an, kennt sie aber weiter beim Namen', async () => {
    for (let n = 2; n <= 16; n++) {
      for (const eigene of [true, false]) {
        const ids = gamesForGroup(n, eigene).map((g) => g.id);
        for (const id of versteckt) expect(ids, `${id} bei ${n}`).not.toContain(id);
      }
    }
    expect(visibleGames()).toHaveLength(GAMES.length - versteckt.length);
    for (const id of versteckt) {
      expect(getGame(id)?.id).toBe(id);
      expect((await loadGame(id)).id).toBe(id);
    }
  });
});
