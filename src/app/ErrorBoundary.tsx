import { Component, type ReactNode } from 'react';

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
          <div className="hero-mark">🫠</div>
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
              location.reload();
            }}
          >
            Lokale Daten zurücksetzen
          </button>
        </div>
      </div>
    );
  }
}
