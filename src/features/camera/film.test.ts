import { describe, expect, it } from 'vitest';
import {
  DEVELOP_CHOICES,
  ROLL_SIZE,
  developAt,
  filmStand,
  isDeveloped,
  myShotsLeft,
  type Photo,
} from '../../store/film';
import { DISPOSABLE, applyFilmLook, viewfinderCrop } from './filmLook';

describe('Anteil am Film', () => {
  const anteil = (o: Partial<Parameters<typeof myShotsLeft>[0]>) =>
    myShotsLeft({ total: ROLL_SIZE, remaining: ROLL_SIZE, mine: 0, devices: 1, ...o });

  it('teilt den Film auf die Geräte auf', () => {
    expect(anteil({ devices: 5 })).toBe(6);
    expect(anteil({ devices: 3 })).toBe(9);
  });

  it('gibt auf einem geteilten Handy den ganzen Film frei', () => {
    // Pass & Play: die Kamera wandert wie eine echte herum.
    expect(anteil({ devices: 1 })).toBe(ROLL_SIZE);
  });

  it('zieht die eigenen Bilder vom Anteil ab', () => {
    expect(anteil({ devices: 3, mine: 4, remaining: 20 })).toBe(5);
  });

  it('lässt niemanden den Film allein leerschießen', () => {
    // Der Kern: wer seinen Anteil ausgeschoepft hat, ist fertig – auch wenn
    // noch reichlich Film da ist, weil die anderen nicht knipsen.
    expect(anteil({ devices: 3, mine: 9, remaining: 18 })).toBe(0);
  });

  it('schrumpft den Anteil, wenn Leute dazukommen', () => {
    expect(anteil({ devices: 3, mine: 3, remaining: 18 })).toBe(6);
    expect(anteil({ devices: 6, mine: 3, remaining: 18 })).toBe(2);
  });

  it('lässt die letzten Bilder trotzdem zu', () => {
    // Sonst bliebe der Film fuer immer halbleer liegen.
    expect(anteil({ devices: 5, remaining: 3, mine: 99 })).toBe(3);
    expect(anteil({ devices: 8, remaining: 1, mine: 99 })).toBe(1);
  });

  it('ist bei leerem Film wirklich zu Ende', () => {
    expect(anteil({ remaining: 0, devices: 3 })).toBe(0);
    expect(anteil({ remaining: -1, devices: 3 })).toBe(0);
  });
});

describe('Entwicklungszeit', () => {
  const abends8 = new Date(2026, 8, 5, 20, 0, 0).getTime();

  it('rechnet Stunden ab Abendbeginn', () => {
    expect(developAt(abends8, 4)).toBe(abends8 + 4 * 3_600_000);
  });

  it('legt den nächsten Morgen auf neun Uhr des Folgetags', () => {
    const d = new Date(developAt(abends8, 0));
    expect(d.getHours()).toBe(9);
    expect(d.getDate()).toBe(6);
  });

  it('wartet bei einem Start nach Mitternacht nur bis zum selben Vormittag', () => {
    // Wer um 2 Uhr anfaengt, will nicht 31 Stunden warten.
    const nachts = new Date(2026, 8, 6, 2, 0, 0).getTime();
    const d = new Date(developAt(nachts, 0));
    expect(d.getDate()).toBe(6);
    expect(d.getHours()).toBe(9);
  });

  it('bietet nur gerastete Werte an', () => {
    expect([...DEVELOP_CHOICES]).toEqual([4, 8, 12, 0]);
  });
});

describe('Einwegkamera-Look', () => {
  const bild = (w: number, h: number, wert = 128) =>
    new Uint8ClampedArray(w * h * 4).fill(wert);

  it('macht die Ecken dunkler als die Mitte', () => {
    const w = 21;
    const h = 21;
    const data = bild(w, h);
    applyFilmLook(data, w, h, DISPOSABLE, () => 0.5);
    const mitte = data[(10 * w + 10) * 4];
    const ecke = data[0];
    expect(mitte).toBeGreaterThan(ecke);
  });

  it('zieht die Farben ins Warme: mehr Rot als Blau', () => {
    const w = 9;
    const h = 9;
    const data = bild(w, h);
    applyFilmLook(data, w, h, DISPOSABLE, () => 0.5);
    const i = (4 * w + 4) * 4;
    expect(data[i]).toBeGreaterThan(data[i + 2]);
  });

  it('erzeugt mit derselben Zufallsquelle dasselbe Korn', () => {
    const seeded = () => {
      let n = 1;
      return () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
    };
    const a = bild(8, 8);
    const b = bild(8, 8);
    applyFilmLook(a, 8, 8, DISPOSABLE, seeded());
    applyFilmLook(b, 8, 8, DISPOSABLE, seeded());
    expect([...a]).toEqual([...b]);
  });

  it('bleibt im gültigen Farbbereich, auch bei hellem Ausgangsbild', () => {
    const data = bild(12, 12, 250);
    applyFilmLook(data, 12, 12, DISPOSABLE, () => 1);
    expect([...data].every((v) => v >= 0 && v <= 255)).toBe(true);
  });
});

describe('Sucher-Versatz', () => {
  it('schneidet auf 3:2 zu', () => {
    const { w, h } = viewfinderCrop(1200, 1600);
    expect(w / h).toBeCloseTo(3 / 2, 5);
  });

  it('zeigt weniger, als der Sucher zeigte, und verschoben', () => {
    // Genau das macht das Ergebnis unvorhersehbar, ohne den Leuten den
    // Sucher wegzunehmen.
    const { x, y, w, h } = viewfinderCrop(1200, 800);
    expect(w).toBeLessThan(1200);
    expect(h).toBeLessThan(800);
    expect(x).not.toBeCloseTo((1200 - w) / 2, 5);
    expect(y).not.toBeCloseTo((800 - h) / 2, 5);
  });
});

describe('Stand des gemeinsamen Films', () => {
  const stand = (o: Partial<Parameters<typeof filmStand>[0]> = {}) =>
    filmStand({ online: true, othersShots: [0, 0], mine: 0, rolls: 1, usedHigh: 0, ...o });

  it('zieht die Bilder ALLER Geräte vom Film ab', () => {
    // Ueber die Verbindung wandert nur diese Zahl, nie ein Bild.
    expect(stand({ othersShots: [3, 2], mine: 4 }).remaining).toBe(ROLL_SIZE - 9);
  });

  it('zählt die eigenen Bilder sofort, nicht erst nach dem Herzschlag', () => {
    // Sonst belichtet ein Geraet im 20-Sekunden-Fenster den halben Film,
    // ohne dass der Rest sinkt.
    expect(stand({ mine: 6 }).remaining).toBe(ROLL_SIZE - 6);
  });

  it('ist nach 27 Bildern wirklich zu Ende', () => {
    const s = stand({ othersShots: [27, 0] });
    expect(s.remaining).toBe(0);
    expect(s.mineLeft).toBe(0);
  });

  it('gibt nie mehr frei, als noch auf dem Film ist', () => {
    expect(stand({ othersShots: [25, 0] }).mineLeft).toBe(2);
  });

  it('stoppt ein Gerät bei seinem Anteil, auch wenn Film übrig ist', () => {
    expect(stand({ othersShots: [0, 0], mine: 9 }).mineLeft).toBe(0);
  });

  it('gibt mit einem zweiten Film genau 27 weitere frei', () => {
    expect(stand({ othersShots: [27, 0], rolls: 2 }).remaining).toBe(ROLL_SIZE);
  });

  it('zählt auf einem geteilten Handy nur den eigenen Verbrauch', () => {
    const s = filmStand({ online: false, othersShots: [99], mine: 5, rolls: 1, usedHigh: 0 });
    expect(s.remaining).toBe(ROLL_SIZE - 5);
    expect(s.mineLeft).toBe(ROLL_SIZE - 5);
  });

  it('rechnet den Anteil neu, wenn jemand dazukommt', () => {
    expect(stand({ othersShots: [3, 3], mine: 3 }).mineLeft).toBe(6);
    expect(stand({ othersShots: [3, 3, 0, 0, 0], mine: 3 }).mineLeft).toBe(2);
  });

  it('gibt keine Bilder zurück, wenn jemand die Runde verlässt', () => {
    // Der Host entfernt inaktive Spieler; ohne den Hoechststand bekaeme der
    // Film deren belichtete Bilder zurueck.
    const vorher = stand({ othersShots: [10, 5] });
    expect(vorher.used).toBe(15);
    const nachher = stand({ othersShots: [5], usedHigh: vorher.used });
    expect(nachher.remaining).toBe(ROLL_SIZE - 15);
  });

  it('setzt den Film bei Verbindungsverlust nicht zurück', () => {
    // Ohne Lobby ist die Spielerliste leer – der Stand muss trotzdem halten.
    expect(stand({ othersShots: [], usedHigh: 20 }).remaining).toBe(ROLL_SIZE - 20);
  });
});

describe('Sperre bis zur Entwicklung', () => {
  const foto = (developAt: number): Photo => ({
    id: 'p1',
    nightId: null,
    at: Date.now(),
    developAt,
    file: 'f.jpg',
  });

  it('gibt ein Bild erst frei, wenn seine Zeit um ist', () => {
    const jetzt = Date.now();
    expect(isDeveloped(foto(jetzt + 60_000), jetzt)).toBe(false);
    expect(isDeveloped(foto(jetzt - 1), jetzt)).toBe(true);
  });

  it('hält den Zeitpunkt je Bild fest, nicht global', () => {
    // Aendert jemand die Einstellung mitten im Abend, sollen schon
    // geschossene Bilder nicht ploetzlich frueher aufgehen.
    const jetzt = Date.now();
    const frueh = foto(jetzt - 1);
    const spaet = foto(jetzt + 3_600_000);
    expect([frueh, spaet].filter((p) => isDeveloped(p, jetzt))).toHaveLength(1);
  });
});
