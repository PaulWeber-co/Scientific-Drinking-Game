import { describe, expect, it } from 'vitest';
import { markTextsSeen, useSeen } from '../../store/seen';
import { CATEGORIES } from './categories';
import { LEVELS, MAX_TERM } from './game';
import { hasIdeas, NO_POOL, nextIdea, type Pool } from './ideas';
import raw from './pools.json';

const pool = raw as Pool;
const norm = (t: string) =>
  t
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

describe('Wer bin ich: Ideen-Pools', () => {
  // Fälle aus der Kategorienliste, nicht aus dem Pool: eine fehlende Kategorie
  // fiele sonst still heraus.
  const withPool = CATEGORIES.map((c) => c.text).filter((t) => !NO_POOL.has(t));

  it('hat für jede eingebaute Kategorie je Stufe mindestens 12 Ideen', () => {
    expect(withPool.length).toBeGreaterThanOrEqual(97);
    for (const cat of withPool) {
      for (const level of LEVELS) {
        expect(pool[cat]?.[level]?.length ?? 0, `${cat} · ${level}`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('kennt keine Kategorie, die es nicht gibt, und keine Stufe außer den drei', () => {
    for (const [cat, levels] of Object.entries(pool)) {
      expect(withPool, `Waise: ${cat}`).toContain(cat);
      expect(Object.keys(levels).sort(), cat).toEqual([...LEVELS].sort());
    }
  });

  it('hat keine Dubletten, auch nicht über Stufen, und nichts länger als ein Begriff sein darf', () => {
    for (const [cat, levels] of Object.entries(pool)) {
      const all = LEVELS.flatMap((l) => levels[l]);
      const keys = all.map(norm);
      const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
      expect(dup, `${cat}: doppelt`).toEqual([]);
      for (const t of all) {
        expect(t.length, `${cat}: „${t}"`).toBeLessThanOrEqual(MAX_TERM);
        expect(t, `${cat}: Leerzeichen`).toBe(t.trim().replace(/\s+/g, ' '));
        expect(norm(t), `${cat}: leer`).not.toBe('');
      }
    }
  });

  it('bietet Ideen nur für eingebaute Kategorien mit Pool an', () => {
    expect(hasIdeas('Tier')).toBe(true);
    expect(hasIdeas(' tier '), 'getippt wie eine eingebaute').toBe(true);
    expect(hasIdeas('Jemand mit Skandal')).toBe(false);
    expect(hasIdeas('Lehrer an unserer Schule')).toBe(false);
  });
});

describe('Wer bin ich: nächste Idee', () => {
  it('schlägt nichts vor, was schon am Tisch liegt, und wiederholt erst, wenn alles gezeigt ist', () => {
    useSeen.setState({ seen: {} });
    const ideas = ['Elefant', 'Giraffe', 'Pinguin'];
    const shown: string[] = [];
    for (let i = 0; i < 2; i++) shown.push(nextIdea(ideas, ['  elefant '], shown)!);
    expect(shown.sort()).toEqual(['Giraffe', 'Pinguin']);
    expect(['Giraffe', 'Pinguin']).toContain(nextIdea(ideas, ['Elefant'], shown));
    expect(nextIdea(['Elefant'], ['Elefant'], []), 'alles vergeben').toBeNull();
  });

  it('zeigt Ungesehenes vor Gesehenem', () => {
    // Gemischt wird zufällig – oft genug ziehen, dass ein Fehler auffällt.
    for (let k = 0; k < 20; k++) {
      useSeen.setState({ seen: {} });
      markTextsSeen(['A', 'C']);
      expect(['B', 'D']).toContain(nextIdea(['A', 'B', 'C', 'D'], [], []));
    }
  });
});
