import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGAL } from './site';

/**
 * Die Datenschutzseite muss JEDEN Schlüssel nennen, den die App auf dem Gerät
 * anlegt — und keinen, den es nicht gibt.
 *
 * Dieser Test existiert, weil beides schon schiefgegangen ist: Ein Eintrag für
 * `sdg.local-players` wurde gestrichen mit der Begründung, den Schlüssel gebe
 * es nicht (er lag in `sessionStorage` und trug die Körperdaten der Gäste),
 * und vier tatsächlich vorhandene Speicher fehlten jahrelang in der Liste.
 *
 * Er liest den Quelltext, statt einer Aufzählung zu vertrauen: Eine Liste, die
 * jemand pflegen muss, ist genau das, was hier auseinandergelaufen ist. Ein
 * neuer Store fällt damit beim ersten Testlauf auf und nicht erst einer
 * Aufsichtsbehörde.
 */

// `import.meta.url` ist unter jsdom eine http-Adresse und taugt hier nicht.
// Vitest läuft aus dem Projektstamm, also von dort aus.
const SRC = join(process.cwd(), 'src');

/** Alle Quelldateien außer Tests – in Tests stehen Schlüssel als Beispiele. */
function quellDateien(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) {
      quellDateien(pfad, out);
    } else if (/\.tsx?$/.test(name) && !name.includes('.test.')) {
      out.push(pfad);
    }
  }
  return out;
}

function schluesselImCode(): Set<string> {
  const gefunden = new Set<string>();
  for (const datei of quellDateien(SRC)) {
    // Die Rechtstexte selbst zählen nicht – sonst prüfte sich die Liste
    // gegen sich selbst und wäre immer vollständig.
    if (datei.includes(join('src', 'legal'))) continue;
    const inhalt = readFileSync(datei, 'utf8');
    for (const treffer of inhalt.matchAll(/['"`](sdg\.[a-z0-9-]+)['"`]/g)) {
      gefunden.add(treffer[1]);
    }
  }
  return gefunden;
}

describe('Schlüsselliste der Datenschutzseite', () => {
  const imCode = schluesselImCode();
  const genannt = new Set(LEGAL.localStores.map((s) => s.key));

  it('findet die Speicher überhaupt', () => {
    // Sicherung gegen einen Test, der still nichts mehr prüft, weil sich der
    // Pfad oder die Schreibweise der Schlüssel geändert hat.
    expect(imCode.size).toBeGreaterThanOrEqual(6);
    expect(imCode).toContain('sdg.player');
  });

  it('nennt jeden Schlüssel, den die App anlegt', () => {
    const fehlend = [...imCode].filter((k) => !genannt.has(k)).sort();
    expect(fehlend, `Nicht in der Datenschutzseite: ${fehlend.join(', ')}`).toEqual([]);
  });

  it('nennt keinen Schlüssel, den es nicht gibt', () => {
    const erfunden = [...genannt].filter((k) => !imCode.has(k)).sort();
    expect(erfunden, `Steht in der Datenschutzseite, aber nirgends im Code: ${erfunden.join(', ')}`)
      .toEqual([]);
  });

  it('beschreibt jeden Eintrag vollständig', () => {
    for (const s of LEGAL.localStores) {
      expect(s.label.length, s.key).toBeGreaterThan(3);
      expect(s.content.length, s.key).toBeGreaterThan(20);
      expect(s.retention.length, s.key).toBeGreaterThan(10);
    }
  });
});
