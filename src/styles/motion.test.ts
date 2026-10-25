import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Der App-Schalter "Bewegung reduzieren" setzt `data-motion="reduced"`, eine
 * Media-Query kann das nicht lesen. Jeder Block, der für die Systemeinstellung
 * etwas abschaltet oder ausblendet, braucht deshalb einen Zwilling mit dem
 * Attribut – sonst bleiben beim Schalter Splitter und Funken stehen, statt zu
 * verschwinden. Gelesen wird aus den Quellen, nicht aus einer Liste.
 */
function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? cssFiles(join(dir, e.name))
      : e.name.endsWith('.css')
        ? [join(dir, e.name)]
        : [],
  );
}

describe('Schalter "Bewegung reduzieren"', () => {
  const files = cssFiles(join(__dirname, '..'));
  const blocks = files.flatMap((f) => {
    const css = readFileSync(f, 'utf8');
    return [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{\n([\s\S]*?)\n\}\n/g)].map(
      (m) => ({ file: f, css, body: m[1] }),
    );
  });

  it('findet die Blöcke überhaupt', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(8);
  });

  it('hat für jeden Selektor eines Blocks einen Zwilling mit data-motion', () => {
    for (const { file, css, body } of blocks) {
      const selectors = [...body.matchAll(/^ {2}([^\s{}][^{}]*?) \{$/gms)]
        .flatMap((m) => m[1].split(','))
        .map((s) => s.trim())
        .filter(Boolean);
      expect(selectors.length, file).toBeGreaterThan(0);
      for (const s of selectors) {
        expect(css.includes(`[data-motion='reduced'] ${s}`), `${file}: ${s}`).toBe(true);
      }
    }
  });
});
