import { describe, expect, it } from 'vitest';
import { DRINK_CATALOG, findDrink, sipsPerServing } from './drinks';
import { makeDrinkEvent } from './sips';
import {
  formatAmount,
  formatEntry,
  eventDrink,
  formatGlassCount,
  formatGlasses,
  formatVolume,
  glassesOf,
  sipsForGlasses,
  tally,
} from './tally';

/**
 * Die Umrechnung Schlucke ↔ Gläser ist der Kern der Übersicht „wer hat wie
 * viel". Stimmt sie nicht, zeigt der Tisch bei jedem falsche Zahlen – und
 * niemand merkt es, weil die Summe in Gramm im Hintergrund weiter stimmt.
 */

const pils = findDrink('beer-pils');
const shot = findDrink('shot-tequila');
const wein = findDrink('wine-white');
const PILS = sipsPerServing(pils);

describe('Gläser und Schlucke', () => {
  it('rechnet ein volles Glas hin und zurück', () => {
    expect(glassesOf(pils, PILS)).toBe(1);
    expect(sipsForGlasses(pils, 1)).toBe(PILS);
    expect(sipsForGlasses(pils, 2)).toBe(PILS * 2);
  });

  it('macht aus einem halben Glas nie null Schlucke', () => {
    // Ein Shot ist EIN Schluck; ein halber Shot bleibt ein ganzer Eintrag.
    expect(sipsForGlasses(shot, 0.5)).toBe(1);
  });
});

describe('formatAmount', () => {
  it('nennt runde Mengen in Gläsern', () => {
    expect(formatAmount(pils, PILS)).toBe('1 Glas');
    expect(formatAmount(pils, PILS * 2)).toBe('2 Gläser');
    expect(formatAmount(pils, sipsForGlasses(pils, 0.5))).toBe('½ Glas');
    expect(formatAmount(pils, sipsForGlasses(pils, 1.5))).toBe('1½ Gläser');
  });

  it('nennt Spiel-Schlucke ehrlich als Schlucke', () => {
    // Drei Schlucke Pils sind kein Glas – und dürfen nicht als „½ Glas"
    // aufgerundet werden, sonst stimmt die Übersicht nicht mehr mit dem
    // Log überein.
    expect(formatAmount(pils, 3)).toBe('3 Schlucke');
    expect(formatAmount(pils, 1)).toBe('1 Schluck');
  });

  it('trifft für JEDES Getränk im Katalog hin und zurück', () => {
    // Ungerade Schluckzahlen (Craft/IPA: 9) runden beim halben Glas – das
    // Sheet verspricht „½ Glas", das Log muss dasselbe sagen.
    for (const d of DRINK_CATALOG.filter((d) => !d.sipIsUnit)) {
      expect(formatAmount(d, sipsForGlasses(d, 0.5)), d.id).toBe('½ Glas');
      expect(formatAmount(d, sipsForGlasses(d, 1)), d.id).toBe('1 Glas');
      expect(formatAmount(d, sipsForGlasses(d, 2)), d.id).toBe('2 Gläser');
    }
  });

  it('zählt Shots je Stück', () => {
    expect(formatAmount(shot, 1)).toBe('1 Shot');
    expect(formatAmount(shot, 2)).toBe('2 Shots');
  });
});

describe('formatEntry', () => {
  it('setzt Menge und Getränk zusammen, ohne „Shot Shot"', () => {
    expect(formatEntry(pils, PILS)).toBe('1 Glas Bier (Pils)');
    expect(formatEntry(pils, 3)).toBe('3 Schlucke Bier (Pils)');
    expect(formatEntry(findDrink('shot-schnaps'), 2)).toBe('2× Shot (Schnaps)');
  });
});

describe('tally', () => {
  it('behält Shot-Einheit und Glasgröße nach Löschen eines eigenen Getränks', () => {
    const custom = { ...shot, id: 'custom-hausshot', name: 'Hausshot', defaultVolumeMl: 40, sipSizeMl: 40 };
    const event = makeDrinkEvent(custom, 2);
    // Das Getränk ist aus dem Katalog entfernt; nur das Ereignis kennt es noch.
    expect(formatEntry(eventDrink(event), event.sips)).toBe('2× Hausshot');
    expect(tally([event]).glasses).toBe(2);
    expect(tally([event]).grams).toBe(event.alcoholGrams);
  });

  it('liest bestehende Einträge ohne Snapshot weiter aus dem Katalog', () => {
    const { drink: _drink, ...oldEvent } = makeDrinkEvent(pils, PILS);
    expect(tally([oldEvent]).glasses).toBe(1);
    expect(formatEntry(eventDrink(oldEvent), oldEvent.sips)).toBe('1 Glas Bier (Pils)');
  });

  it('summiert je Getränk und sortiert das Schwerste nach vorn', () => {
    const log = [
      makeDrinkEvent(pils, 3, 'kings-cup'),
      makeDrinkEvent(shot, 2, 'glas'),
      makeDrinkEvent(pils, PILS, 'glas'),
    ];
    const t = tally(log);
    expect(t.rows.map((r) => r.drink.id)).toEqual(['beer-pils', 'shot-tequila']);
    expect(t.rows[0].sips).toBe(PILS + 3);
    expect(t.rows[0].glasses).toBeCloseTo(1 + 3 / PILS, 5);
    expect(t.rows[1].glasses).toBe(2);
    expect(t.glasses).toBeCloseTo(3 + 3 / PILS, 5);
    expect(t.grams).toBeCloseTo(log.reduce((s, e) => s + e.alcoholGrams, 0), 5);
  });

  it('behält den Namen aus dem Eintrag, auch wenn das Getränk unbekannt ist', () => {
    // Ein Gast mit eigenem Getränk: die Kennung kennt dieses Gerät nicht,
    // der Name im Eintrag ist trotzdem richtig.
    const fremd = { ...wein, id: 'custom-xyz', name: 'Omas Likör' };
    const t = tally([makeDrinkEvent(fremd, 2, 'glas')]);
    expect(t.rows[0].name).toBe('Omas Likör');
  });

  it('ist bei leerem Log leer', () => {
    expect(tally([])).toEqual({ rows: [], glasses: 0, grams: 0 });
  });

  it('summiert jedes historische Glas nach seiner eigenen Größe', () => {
    const small = makeDrinkEvent(pils, PILS, 'manuell', undefined, 330);
    const changedServing = { ...pils, defaultVolumeMl: 500 };
    const large = makeDrinkEvent(changedServing, 13, 'manuell', undefined, 500);
    expect(tally([small, large]).glasses).toBe(2);
    expect(tally([large, small]).glasses).toBe(2);
    expect(tally([small, large]).grams).toBeCloseTo(small.alcoholGrams + large.alcoholGrams, 8);
  });

  it('behält exakte Mengen, Namen und Stärke nach dem Löschen des eigenen Getränks', () => {
    const custom = { ...pils, id: 'custom-genau', name: 'Hausbier' };
    const event = makeDrinkEvent(custom, 13, 'manuell', undefined, 500);
    expect(formatEntry(eventDrink(event), event.sips, event.drinkName, event.volumeMl)).toBe('0,5 l Hausbier');
    expect(tally([event]).glasses).toBeCloseTo(500 / 330, 8);
    expect(event.alcoholGrams).toBe(19.73);
  });

  it('nennt einen manuell eingetragenen halben Shot als halbes Glas statt ganzen Shot', () => {
    const event = makeDrinkEvent(shot, 1, 'manuell', undefined, 10);
    expect(formatEntry(shot, event.sips, event.drinkName, event.volumeMl)).toBe('½ Glas Tequila / Wodka');
    expect(tally([event]).glasses).toBe(0.5);
    expect(formatVolume(shot, event.sips, event.volumeMl)).toBe('1 cl');
  });
});

describe('Kurzform', () => {
  it('rundet auf halbe Gläser', () => {
    expect(formatGlasses(0)).toBe('0');
    expect(formatGlasses(0.4)).toBe('½');
    expect(formatGlasses(1)).toBe('1');
    expect(formatGlasses(2.6)).toBe('2½');
    expect(formatGlasses(2.8)).toBe('3');
  });
});

describe('Menge in Litern', () => {
  // Rückmeldung aus dem Test: „Was ist Ganzes und Halbes?" – die Kachel sagt
  // deshalb, wie viel wirklich gebucht wird.
  it('nennt große Mengen in Litern, Shots in Zentilitern', () => {
    const weizen = findDrink('beer-wheat');
    const shot = findDrink('shot-schnaps');
    expect(formatVolume(weizen, sipsForGlasses(weizen, 1))).toBe('0,5 l');
    expect(formatVolume(weizen, sipsForGlasses(weizen, 2))).toBe('1 l');
    expect(formatVolume(pils, sipsForGlasses(pils, 1))).toBe('0,33 l');
    expect(formatVolume(shot, sipsForGlasses(shot, 1))).toBe('2 cl');
  });

  it('zeigt beim halben Shot ehrlich den ganzen', () => {
    const shot = findDrink('shot-schnaps');
    expect(formatVolume(shot, sipsForGlasses(shot, 0.5))).toBe('2 cl');
  });

  it('setzt Glas und Gläser richtig', () => {
    expect(formatGlassCount(0.5)).toBe('½ Glas');
    expect(formatGlassCount(1)).toBe('1 Glas');
    expect(formatGlassCount(2)).toBe('2 Gläser');
  });
});
