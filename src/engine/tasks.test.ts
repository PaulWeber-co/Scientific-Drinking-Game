import { describe, expect, it } from 'vitest';
import { seenKey } from '../lib/seen';
import { TASKS, taskFor, type TaskContext, type TaskFrequency, type TaskReason } from './tasks';

const ctx = (patch: Partial<TaskContext> = {}): TaskContext => ({
  reason: 'blocked',
  seed: 'p1|runde-1',
  spicy: false,
  frequency: 'manchmal',
  seen: {},
  ...patch,
});

/** Viele Seeds, damit Aussagen über Anteile nicht an einem Zufall hängen. */
const seeds = Array.from({ length: 400 }, (_, i) => `p${i % 7}|runde-${i}`);

describe('Katalog', () => {
  it('ist groß genug, dass ein Abend nicht durchläuft', () => {
    // Untergrenze, nicht Zierde: bei 6 Spielern und der Haelfte Aussetzern
    // waeren 40 Aufgaben nach einer Stunde durch.
    expect(TASKS.length).toBeGreaterThanOrEqual(100);
  });

  it('hat für jede Sorte auch ohne Spicy etwas im Topf', () => {
    // Waere eine Kombination leer, lieferte `taskFor` still `null` – die
    // Aufgabe fiele aus, ohne dass irgendwo etwas rot wird.
    for (const kind of ['share', 'action'] as const) {
      const ohneSpicy = TASKS.filter((t) => t.kind === kind && !t.spicy);
      expect(ohneSpicy.length, `${kind} ohne Spicy ist leer`).toBeGreaterThanOrEqual(20);
    }
  });

  it('enthält keinen Text doppelt', () => {
    // Doppelte Texte teilen sich einen Gedaechtnis-Schluessel: die zweite
    // Karte gaelte sofort als gesehen und kaeme nie dran.
    expect(new Set(TASKS.map((t) => t.text)).size).toBe(TASKS.length);
  });

  it('nennt nirgends eine Schluckzahl', () => {
    // Harte Invariante: ein Spiel meldet Härte, nie eine fertige Menge – die
    // rechnet jedes Gerät aus seinen eigenen Körperdaten.
    const zahlwort =
      /\b(einen|ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|\d+)\s+Schluck/i;
    const treffer = TASKS.filter((t) => zahlwort.test(t.text));
    expect(treffer.map((t) => t.text)).toEqual([]);
  });
});

describe('Wer eine Aufgabe bekommt', () => {
  it('gibt Gesperrten immer eine – auch wenn Aufgaben abgeschaltet sind', () => {
    // Fahrer, unter 18 und alkoholfrei bekommen den ganzen Abend keine
    // Schlucke. Fuer sie ist die Aufgabe das Spiel, nicht die Zugabe.
    for (const frequency of ['aus', 'manchmal', 'immer'] as TaskFrequency[]) {
      for (const seed of seeds.slice(0, 50)) {
        expect(taskFor(ctx({ reason: 'blocked', frequency, seed })), frequency).not.toBeNull();
      }
    }
  });

  it('schweigt beim Aussetzen, wenn der Schalter auf „Nie" steht', () => {
    for (const reason of ['maintaining', 'water'] as TaskReason[]) {
      for (const seed of seeds.slice(0, 50)) {
        expect(taskFor(ctx({ reason, frequency: 'aus', seed })), reason).toBeNull();
      }
    }
  });

  it('gibt beim Aussetzen immer eine, wenn der Schalter auf „Immer" steht', () => {
    for (const seed of seeds.slice(0, 50)) {
      expect(taskFor(ctx({ reason: 'maintaining', frequency: 'immer', seed }))).not.toBeNull();
    }
  });

  it('gibt bei „Manchmal" etwa jede zweite Ansage eine', () => {
    const mit = seeds.filter((seed) =>
      taskFor(ctx({ reason: 'maintaining', frequency: 'manchmal', seed })),
    ).length;
    const anteil = mit / seeds.length;
    expect(anteil).toBeGreaterThan(0.35);
    expect(anteil).toBeLessThan(0.65);
  });
});

describe('Welche Aufgabe', () => {
  it('liefert für dieselbe Ansage zweimal dasselbe', () => {
    // Die Auswahl laeuft in einer Komponente. Waere sie zufaellig, stuende bei
    // jedem Re-Render eine andere Aufgabe da.
    const a = taskFor(ctx({ seed: 'p3|runde-9' }));
    const b = taskFor(ctx({ seed: 'p3|runde-9' }));
    expect(a).toBe(b);
  });

  it('liefert für verschiedene Spieler in derselben Runde Verschiedenes', () => {
    const texte = new Set(
      ['p1', 'p2', 'p3', 'p4'].map((id) => taskFor(ctx({ seed: `${id}|runde-1` }))?.text),
    );
    expect(texte.size).toBeGreaterThan(1);
  });

  it('gibt Gesperrten überwiegend Einfluss, Aussetzern überwiegend etwas zu tun', () => {
    const anteil = (reason: TaskReason, kind: 'share' | 'action') => {
      const alle = seeds.map((seed) => taskFor(ctx({ reason, frequency: 'immer', seed })));
      return alle.filter((t) => t?.kind === kind).length / alle.length;
    };
    // Je Prüfzeile eine Ober- UND eine Untergrenze: „überwiegend" allein
    // bliebe auch dann grün, wenn die Bevorzugung zur Ausschließlichkeit
    // würde und die andere Sorte nie käme.
    expect(anteil('blocked', 'share')).toBeGreaterThan(0.6);
    expect(anteil('blocked', 'share')).toBeLessThan(0.9);
    expect(anteil('maintaining', 'action')).toBeGreaterThan(0.6);
    expect(anteil('maintaining', 'action')).toBeLessThan(0.9);
    expect(anteil('blocked', 'action')).toBeGreaterThan(0.1);
  });

  it('hält Spicy-Aufgaben zurück, solange der Schalter aus ist', () => {
    const spicyDabei = seeds
      .map((seed) => taskFor(ctx({ spicy: false, frequency: 'immer', seed })))
      .some((t) => t?.spicy);
    expect(spicyDabei).toBe(false);
  });

  it('lässt Spicy-Aufgaben zu, wenn der Schalter an ist', () => {
    // Gegenprobe zum Test darueber: ohne sie wuerde ein leerer Spicy-Anteil
    // faelschlich als „Filter funktioniert" durchgehen.
    const spicyDabei = seeds
      .map((seed) => taskFor(ctx({ spicy: true, frequency: 'immer', seed })))
      .some((t) => t?.spicy);
    expect(spicyDabei).toBe(true);
  });
});

describe('Gedächtnis', () => {
  it('wiederholt keine Aufgabe, solange noch ungesehene da sind', () => {
    const seen: Record<string, number> = {};
    let cursor = 0;
    const gezogen: string[] = [];
    // Obergrenze ist der KLEINERE der beiden Töpfe: bei 'blocked' fallen rund
    // drei Viertel der Züge auf 'share'. Zöge man so oft wie es Aufgaben
    // insgesamt gibt, wäre der share-Topf zu Recht durch und der Test würde
    // eine erlaubte Wiederholung als Fehler melden.
    const zuege = TASKS.filter((t) => t.kind === 'share' && !t.spicy).length;
    // Untergrenze: schrumpfte der Topf auf null, liefe die Schleife nicht und
    // beide Zusicherungen unten wären 0 === 0 – grün ohne eine echte Prüfung.
    expect(zuege).toBeGreaterThan(10);
    for (let i = 0; i < zuege; i++) {
      const task = taskFor(ctx({ reason: 'blocked', seed: `p1|runde-${i}`, seen }));
      expect(task, `Zug ${i} lieferte keine Aufgabe`).not.toBeNull();
      gezogen.push(task!.text);
      seen[seenKey(task!.text)] = ++cursor;
    }
    expect(gezogen).toHaveLength(zuege);
    expect(new Set(gezogen).size, 'eine Aufgabe kam zweimal').toBe(gezogen.length);
  });

  it('macht weiter, wenn alles gesehen ist, statt nichts mehr zu liefern', () => {
    const seen: Record<string, number> = {};
    TASKS.forEach((t, i) => (seen[seenKey(t.text)] = i + 1));
    expect(taskFor(ctx({ reason: 'blocked', seen }))).not.toBeNull();
  });

  it('nimmt danach das am längsten Zurückliegende', () => {
    const seen: Record<string, number> = {};
    // Nummern in Katalogreihenfolge: der erste Eintrag jeder Sorte ist damit
    // der am längsten zurückliegende.
    TASKS.forEach((t, i) => (seen[seenKey(t.text)] = i + 1));
    const task = taskFor(ctx({ reason: 'blocked', seed: 'p1|runde-1', seen }));
    expect(task).not.toBeNull();
    // Ohne Fallunterscheidung: geprüft wird gegen die Sorte, die tatsächlich
    // gezogen wurde – sonst liefe der Test bei der anderen Sorte leer durch.
    const aeltester = TASKS.find((t) => t.kind === task!.kind && !t.spicy)!;
    expect(task!.text).toBe(aeltester.text);
  });
});
