import { describe, expect, it } from 'vitest';
import { CARDS } from './index';

/**
 * Spiegelt `createCardGame`s Voreinstellung für dieses Spiel exakt:
 * `card?.target ?? (config.drink === 'all' ? 'all' : 'actor')`, und
 * `chaos-roulette` läuft mit `drink: 'actor'` (siehe `index.ts`). Eine Karte
 * ohne `target` trifft also die Person am Zug, keine andere.
 */
const resolvedTarget = (card: (typeof CARDS)[number]): 'all' | 'actor' => card.target ?? 'actor';

describe('Chaos-Roulette: Kartentext trifft die tatsächliche Ansage', () => {
  it('hat überhaupt Karten zu prüfen', () => {
    // Untergrenze, damit die folgenden Checks nicht mangels Daten grün wären.
    expect(CARDS.length).toBe(34);
  });

  it('verspricht keine Teilmenge, die die App nicht kennt ("Alle, die/mit …")', () => {
    // Das Muster des behobenen Fehlers: "Alle mit weißen Sneakern: trinkt."
    // klingt nach einer Teilmenge, traf aber – wie jede `target: 'all'`-Karte
    // – ausnahmslos jede Person, auch barfuß. Das Modell kennt keine
    // Teilmenge, also darf kein Kartentext eine versprechen.
    const NENNT_TEILMENGE = /\balle\b,?\s+(die|der|das|denen|mit|anderen?)\b/i;
    // Selbstprobe am historischen Fehlerbild: bricht die Regex, faende sie auch
    // hier nichts mehr - und der Test bliebe mit null Treffern gruen, ohne je
    // etwas geprueft zu haben.
    expect(NENNT_TEILMENGE.test('Alle, die weiße Sneaker tragen, trinken.')).toBe(true);
    expect(NENNT_TEILMENGE.test('Alle mit Tattoo trinken.')).toBe(true);
    // „Alle anderen" schliesst textlich jemanden aus – auch das ist eine
    // Teilmenge, die das Kartenmodell nicht kennt. Ohne diesen Fall rutschte
    // genau eine Karte durch, obwohl der Test dafuer gebaut wurde.
    expect(NENNT_TEILMENGE.test('Wer faehrt, setzt aus. Alle anderen trinken.')).toBe(true);
    expect(NENNT_TEILMENGE.test('Alle trinken einen Schluck.')).toBe(false);
    const treffer = CARDS.filter((c) => NENNT_TEILMENGE.test(c.text));
    expect(treffer.map((c) => c.text)).toEqual([]);
  });

  it('lässt keine extern bestimmte Zielperson an der Voreinstellung "Person am Zug" vorbei', () => {
    // Das zweite Beispiel des Befunds: "Der jüngste Mensch in der Runde:
    // trink." hatte kein `target` und traf darum die Person am Zug statt die
    // jüngste. Jede Karte, die eine Person über Alter, Tempo, Abstimmung oder
    // einen offenen Duell-Ausgang benennt, kann die App nicht gezielt
    // ansprechen – ehrlich geht das nur als Ansage an alle.
    const NENNT_EXTERNE_ZIELPERSON =
      /\b(jüngst\w*|ältest\w*|schnellst\w*|langsamst\w*|häufigst\w*|meist\w*|verlierer|gewinner)\b/i;
    const betroffen = CARDS.filter((c) => NENNT_EXTERNE_ZIELPERSON.test(c.text));
    // Die Prüfung muss selbst etwas abgreifen, sonst wäre sie mangels Treffer grün.
    expect(betroffen.length).toBeGreaterThan(0);
    for (const card of betroffen) {
      expect(resolvedTarget(card), card.text).toBe('all');
    }
  });
});
