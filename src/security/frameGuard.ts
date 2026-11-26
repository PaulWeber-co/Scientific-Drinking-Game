/**
 * Clickjacking-Schutz für GitHub Pages.
 *
 * Der richtige Weg wäre der Header `Content-Security-Policy: frame-ancestors
 * 'none'` (bzw. `X-Frame-Options: DENY`). GitHub Pages erlaubt keine eigenen
 * Header, und `frame-ancestors` wirkt im Meta-Tag nicht. Deshalb prüft die
 * App selbst: Liegt sie in einem Rahmen einer FREMDEN Seite, rendert sie
 * nicht – nur einen Link, der sie ohne Rahmen öffnet. Eigene Rahmen (gleiche
 * Herkunft, etwa Vorschau-Werkzeuge) bleiben erlaubt.
 */
export function framedByOtherSite(win: Pick<Window, 'top' | 'self' | 'location'> = window): boolean {
  try {
    if (!win.top || win.top === win.self) return false;
    // Fremde Herkunft: der Zugriff wirft (SecurityError) – dann gilt der
    // Rahmen als fremd.
    return win.top.location.origin !== win.location.origin;
  } catch {
    return true;
  }
}
