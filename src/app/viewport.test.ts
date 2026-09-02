import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest läuft vom Projektroot (vite.config.ts liegt dort).
const root = process.cwd();

// Trefferflächen selbst lassen sich ohne Layout nicht testen – das macht
// das Playwright-Skript. Hier nur, was jsdom prüfen kann: Zoom bleibt
// erlaubt, Doppeltipp-Zoom ist per CSS unterbunden.
describe('Zoom bleibt erlaubt', () => {
  it('Viewport-Tag sperrt das Vergrößern nicht', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const meta = html.match(/name="viewport"[\s\S]*?content="([^"]+)"/)?.[1] ?? '';
    expect(meta).toContain('width=device-width');
    expect(meta).not.toMatch(/user-scalable\s*=\s*no/);
    expect(meta).not.toMatch(/maximum-scale/);
  });

  it('Doppeltipp-Zoom ist für Knöpfe, Links und Eingaben per touch-action aus', () => {
    const css = readFileSync(join(root, 'src/styles/global.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = css.match(/[^{}]+\{[^{}]*touch-action:\s*manipulation[^{}]*\}/g) ?? [];
    const selectors = rules.map((r) => r.slice(0, r.indexOf('{')).replace(/\s+/g, ' ').trim());
    for (const sel of ['button', 'a', 'input', '.pressable']) {
      expect(selectors.some((s) => s.split(',').map((x) => x.trim()).includes(sel))).toBe(true);
    }
  });
});
