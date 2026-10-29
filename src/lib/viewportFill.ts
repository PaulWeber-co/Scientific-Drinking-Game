/**
 * Füllt kurze Seiten bis zum echten Bildschirmrand auf.
 *
 * Als Web-App auf dem Homescreen (Statusleiste durchscheinend) rechnet iOS
 * die Seite um die Höhe der Statusleiste kürzer, als der Bildschirm ist. Ist
 * eine Seite kürzer als der Bildschirm, richtet WebKit fest positionierte
 * Elemente am Ende der Seite aus statt am Bildschirmrand – die Tab-Leiste
 * schwebte in der Runde dadurch rund 59 pt zu hoch. Auf langen Seiten, die
 * scrollen, stimmt alles; deshalb fiel es nur auf kurzen Seiten auf.
 *
 * Gemessen statt geraten: Die Lücke ist die Differenz zwischen sichtbarer
 * Höhe und der Höhe, mit der die Seite rechnet. Sie wird nur ausgeglichen,
 * wenn sie genau dieses Muster zeigt – höchstens so groß wie die
 * Statusleiste. Überall sonst bleibt der Ausgleich 0 und ändert nichts.
 */

export interface ViewportSizes {
  /** Höhe, die tatsächlich sichtbar ist. */
  visible: number;
  /** Höhe, mit der die Seite rechnet (`documentElement.clientHeight`). */
  layout: number;
  /** Abstand der Statusleiste (`env(safe-area-inset-top)`). */
  safeTop: number;
}

/** Wie viel die Seite unten länger sein muss, um den Bildschirm zu füllen. */
export function viewportFill({ visible, layout, safeTop }: ViewportSizes): number {
  if (!(layout > 0) || !(visible > 0) || !(safeTop > 0)) return 0;
  const gap = Math.round(visible - layout);
  // Eine Lücke größer als die Statusleiste ist etwas anderes (geteilter
  // Bildschirm, Browserleisten) – dann lieber nichts tun als falsch.
  return gap > 0 && gap <= Math.ceil(safeTop) + 2 ? gap : 0;
}

function standalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || (window.matchMedia?.('(display-mode: standalone)').matches ?? false);
}

/** Sichtbare Höhe: auf dem Homescreen der ganze Bildschirm, sonst das Fenster. */
function visibleHeight(): number {
  if (!standalone() || typeof screen === 'undefined') return window.innerHeight;
  // iOS meldet die Bildschirmmaße immer im Hochformat.
  const portrait = window.innerHeight >= window.innerWidth;
  const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  return Math.max(window.innerHeight, full);
}

function safeTopInset(): number {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:env(safe-area-inset-top,0px)';
  document.body.appendChild(probe);
  const value = probe.getBoundingClientRect().height;
  probe.remove();
  return value;
}

/** Misst bei Start, Drehen und Größenänderung und setzt `--viewport-fill`. */
export function initViewportFill(): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const apply = () => {
    const fill = viewportFill({
      visible: visibleHeight(),
      layout: root.clientHeight,
      safeTop: safeTopInset(),
    });
    if (fill) root.style.setProperty('--viewport-fill', `${fill}px`);
    else root.style.removeProperty('--viewport-fill');
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  window.addEventListener('pageshow', apply);
  window.visualViewport?.addEventListener('resize', apply);
}
