import { describe, expect, it } from 'vitest';
import { CSP_DIRECTIVES, contentSecurityPolicy } from './csp';
import { framedByOtherSite } from './frameGuard';

describe('Content Security Policy', () => {
  it('erlaubt keine Inline-Skripte, kein eval und keine Plugins', () => {
    expect(CSP_DIRECTIVES['script-src']).toEqual(["'self'"]);
    expect(contentSecurityPolicy()).not.toMatch(/unsafe-inline|unsafe-eval|\*;|\s\*\s/);
    expect(CSP_DIRECTIVES['object-src']).toEqual(["'none'"]);
    expect(CSP_DIRECTIVES['base-uri']).toEqual(["'self'"]);
    expect(CSP_DIRECTIVES['frame-src']).toEqual(["'none'"]);
  });

  it('lässt Netzverbindungen nur zu Firebase zu', () => {
    const fremd = CSP_DIRECTIVES['connect-src'].filter(
      (s) => !["'self'", 'data:', 'blob:'].includes(s),
    );
    for (const host of fremd) {
      expect(host).toMatch(
        /^(https|wss):\/\/(\*\.firebasedatabase\.app|\*\.firebaseio\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com)$/,
      );
    }
  });

  it('enthält kein upgrade-insecure-requests (Android-Hülle läuft unter http://localhost)', () => {
    expect(contentSecurityPolicy()).not.toContain('upgrade-insecure-requests');
  });
});

describe('Clickjacking-Schutz', () => {
  const loc = { origin: 'https://paulweber-co.github.io' } as Location;

  it('rendert normal, wenn die App nicht gerahmt ist', () => {
    const win = { location: loc } as Window;
    Object.assign(win, { top: win, self: win });
    expect(framedByOtherSite(win)).toBe(false);
  });

  it('erkennt einen Rahmen einer fremden Seite (Zugriff wirft)', () => {
    const top = {
      get location(): Location {
        throw new DOMException('Blocked a frame', 'SecurityError');
      },
    } as unknown as Window;
    const win = { location: loc, top, self: {} } as unknown as Window;
    expect(framedByOtherSite(win)).toBe(true);
  });

  it('lässt Rahmen derselben Herkunft zu', () => {
    const top = { location: { origin: loc.origin } } as unknown as Window;
    const win = { location: loc, top, self: {} } as unknown as Window;
    expect(framedByOtherSite(win)).toBe(false);
  });
});
