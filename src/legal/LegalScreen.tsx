import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { NavBar } from '../components/ui';
import { LEGAL, hasPlaceholders } from './site';

/**
 * Gemeinsamer Rahmen für Impressum und Datenschutz.
 *
 * Beide sind eigene Routen statt Sheets: Ein Impressum muss verlinkbar und
 * direkt aufrufbar sein, ein halb geöffnetes Overlay ist das nicht.
 */
export function LegalScreen({ title, children }: { title: string; children: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="screen">
      <NavBar
        title={title}
        left={
          <button className="btn btn--plain" onClick={() => nav(-1)}>
            Zurück
          </button>
        }
      />
      <div className="stack-6 legal">
        {hasPlaceholders() && (
          <div className="notice notice--red">
            <strong>Noch nicht ausgefüllt.</strong> In <code>src/legal/site.ts</code> stehen
            Platzhalter. Ohne vollständige Angaben ist die Seite nicht abmahnsicher.
          </div>
        )}
        {children}
        <p className="t-caption t-center">Stand: {formatDate(LEGAL.lastUpdated)}</p>
      </div>
    </div>
  );
}

/** Ein Abschnitt mit Überschrift – hält die Rechtstexte optisch ruhig. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack-3">
      <h2 className="list-header t-upper">{title}</h2>
      {children}
    </section>
  );
}

/** Beschriftete Zeile für Tabellen-artige Angaben. */
export function LegalRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="legal__row">
      <span className="t-caption legal__label">{label}</span>
      <span className="t-body">{children}</span>
    </div>
  );
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}
