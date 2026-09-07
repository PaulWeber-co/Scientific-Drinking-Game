import { Component, type ReactNode } from 'react';
import { Icon } from '../components/icons';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Eine Party soll nicht an einem weißen Bildschirm enden. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Unerwarteter Fehler', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen screen--full center" style={{ minHeight: '100dvh' }}>
        <div className="stack-3 t-center">
          <div className="hero-mark">
            <Icon name="alert" size={64} strokeWidth={1.2} />
          </div>
          <h1 className="t-title">Da ist was schiefgelaufen.</h1>
          <p className="t-sub">{this.state.error.message}</p>
          <button className="btn btn--brand" onClick={() => location.reload()}>
            App neu laden
          </button>
          <button
            className="btn btn--plain"
            onClick={() => {
              localStorage.removeItem('sdg.player');
              localStorage.removeItem('sdg.app');
              // Der laufende Abend ist mit dem Log weg. Seine angefangene
              // Teilnehmerliste muss mit, sonst tauchen die Namen von heute
              // im nächsten Abend wieder auf. Die Rückblicke selbst bleiben
              // stehen – die sind der Grund, warum hier nicht alles fliegt.
              vergissLaufendenAbend();
              location.reload();
            }}
          >
            Profil zurücksetzen
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Räumt den angefangenen Abend aus dem Speicher, ohne die Rückblicke
 * anzufassen.
 *
 * Direkt am `localStorage` statt über die Stores: dieser Knopf ist der
 * Notausgang, wenn die App gar nicht mehr läuft — dann ist auch nicht
 * sicher, dass sich ein Store noch bedienen lässt.
 */
function vergissLaufendenAbend(): void {
  try {
    const roh = localStorage.getItem('sdg.nights');
    if (roh) {
      const daten = JSON.parse(roh) as { state?: { current?: unknown } };
      if (daten.state) daten.state.current = [];
      localStorage.setItem('sdg.nights', JSON.stringify(daten));
    }
    const film = localStorage.getItem('sdg.film');
    if (film) {
      const daten = JSON.parse(film) as {
        state?: { mine?: number; rolls?: number; usedHigh?: number };
      };
      if (daten.state) {
        daten.state.mine = 0;
        daten.state.rolls = 1;
        daten.state.usedHigh = 0;
      }
      localStorage.setItem('sdg.film', JSON.stringify(daten));
    }
  } catch {
    // Kaputter Eintrag: dann lieber ganz weg als halb.
    localStorage.removeItem('sdg.nights');
    localStorage.removeItem('sdg.film');
  }
}
