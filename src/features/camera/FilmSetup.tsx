import { DEVELOP_CHOICES, useFilm } from '../../store/film';
import { haptic } from '../../lib/haptics';
import { Icon } from '../../components/icons';
import { useParty } from '../party/PartyContext';
import { useFilmStatus } from './useFilmStatus';

/** Beschriftung der Rastungen. Die 0 ist der Sonderfall „nächster Morgen". */
function label(h: number): string {
  return h === 0 ? 'Morgen früh' : `${h} Std.`;
}

/**
 * Entwicklungszeit und Nachschub.
 *
 * Sichtbar nur für die Person, die die Runde eröffnet hat: die Zeit gilt für
 * alle, und zwei Leute, die abwechselnd daran drehen, wären das Gegenteil
 * einer gemeinsamen Kamera.
 */
export function FilmSetup() {
  const party = useParty();
  const { remaining, developAfterH, canSetup } = useFilmStatus();
  const setLocal = useFilm((s) => s.setDevelopAfterH);
  const loadRoll = useFilm((s) => s.loadRoll);
  const rolls = useFilm((s) => s.rolls);

  if (!canSetup) return null;

  const setzen = (h: number) => {
    haptic('tap');
    setLocal(h);
    party.setFilm({ developAfterH: h });
  };

  return (
    <section className="card stack-3">
      <div className="stack-2">
        <span className="t-headline">Wann wird entwickelt?</span>
        <span className="t-caption">Gilt für alle in der Runde, gerechnet ab Abendbeginn.</span>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {DEVELOP_CHOICES.map((h) => (
          <button
            key={h}
            className={`chip pressable${h === developAfterH ? ' chip--on' : ''}`}
            aria-pressed={h === developAfterH}
            onClick={() => setzen(h)}
          >
            <span className="chip__text">{label(h)}</span>
          </button>
        ))}
      </div>

      {remaining === 0 && (
        <button
          className="btn btn--glass btn--block"
          onClick={() => {
            haptic('select');
            loadRoll();
            party.setFilm({ rolls: (party.film?.rolls ?? rolls) + 1 });
          }}
        >
          <Icon name="refresh" size={17} /> Neuen Film einlegen
        </button>
      )}
    </section>
  );
}
