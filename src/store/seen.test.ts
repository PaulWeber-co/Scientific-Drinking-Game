import { beforeEach, describe, expect, it } from 'vitest';
import { freshestFirst, seenKey } from '../lib/seen';
import {
  SEEN_CAPACITY,
  SEEN_KEEP,
  markTextsSeen,
  orderByFreshness,
  prune,
  useSeen,
} from './seen';

beforeEach(() => {
  useSeen.setState({ seen: {}, cursor: 0 });
  localStorage.clear();
});

describe('Schlüssel', () => {
  it('ist für denselben Text derselbe und für anderen Text ein anderer', () => {
    expect(seenKey('Trink einen Schluck')).toBe(seenKey('Trink einen Schluck'));
    expect(seenKey('Trink einen Schluck')).not.toBe(seenKey('Trink zwei Schluck'));
  });

  it('vergibt für den ganzen Katalog eindeutige Schlüssel', () => {
    // Der Schluessel ist ein 32-Bit-Hash. Bei rund 600 Texten waere eine
    // Kollision unwahrscheinlich, aber nicht unmoeglich – und sie wuerde eine
    // Karte stumm verschwinden lassen. Deshalb wird sie geprueft, nicht
    // angenommen.
    const texte = Array.from({ length: 2000 }, (_, i) => `Aufgabe Nummer ${i} mit Text`);
    expect(new Set(texte.map(seenKey)).size).toBe(texte.length);
  });
});

describe('Reihenfolge nach Frische', () => {
  const keyOf = (s: string) => s;

  it('lässt Ungesehenes vorn und in der übergebenen Reihenfolge', () => {
    expect(freshestFirst(['a', 'b', 'c'], keyOf, {})).toEqual(['a', 'b', 'c']);
  });

  it('schiebt Gesehenes nach hinten', () => {
    expect(freshestFirst(['a', 'b', 'c'], keyOf, { a: 5 })).toEqual(['b', 'c', 'a']);
  });

  it('nimmt unter den Gesehenen das am längsten Zurückliegende zuerst', () => {
    expect(freshestFirst(['a', 'b', 'c'], keyOf, { a: 9, b: 2, c: 5 })).toEqual(['b', 'c', 'a']);
  });

  it('läuft nicht leer, wenn alles gesehen ist', () => {
    // Der Unterschied zwischen "nicht wiederholen" und "nicht mehr ziehen
    // koennen". Ein reines Gesehen-Flag haette hier eine leere Liste geliefert.
    const alle = freshestFirst(['a', 'b'], keyOf, { a: 1, b: 2 });
    expect(alle).toHaveLength(2);
    expect(alle[0]).toBe('a');
  });
});

describe('Gedächtnis', () => {
  it('merkt sich Texte und ordnet danach', () => {
    markTextsSeen(['a']);
    expect(orderByFreshness(['a', 'b'], (s) => s)).toEqual(['b', 'a']);
  });

  it('vergibt aufsteigende Nummern, damit die Reihenfolge stimmt', () => {
    markTextsSeen(['a']);
    markTextsSeen(['b']);
    const { seen } = useSeen.getState();
    expect(seen[seenKey('b')]).toBeGreaterThan(seen[seenKey('a')]);
  });

  it('überlebt den Neustart', () => {
    markTextsSeen(['a']);
    const abgelegt = localStorage.getItem('sdg.seen');
    expect(abgelegt, 'nichts im localStorage abgelegt').not.toBeNull();
    expect(abgelegt).toContain(seenKey('a'));
  });

  it('vergisst beim Überlauf die ältesten und behält die neuesten', () => {
    const voll: Record<string, number> = {};
    for (let i = 0; i < SEEN_CAPACITY + 100; i++) voll[`k${i}`] = i;
    const gekuerzt = prune(voll);
    expect(Object.keys(gekuerzt)).toHaveLength(SEEN_KEEP);
    // Die zuletzt gesehenen tragen die hoechsten Nummern.
    expect(gekuerzt[`k${SEEN_CAPACITY + 99}`]).toBe(SEEN_CAPACITY + 99);
    expect(gekuerzt.k0).toBeUndefined();
  });

  it('räumt unterhalb der Grenze gar nicht auf', () => {
    const knapp: Record<string, number> = {};
    for (let i = 0; i < SEEN_CAPACITY; i++) knapp[`k${i}`] = i;
    expect(Object.keys(prune(knapp))).toHaveLength(SEEN_CAPACITY);
  });
});
