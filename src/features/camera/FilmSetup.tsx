import { useState } from 'react';
import { DEVELOP_CHOICES, useFilm } from '../../store/film';
import { haptic } from '../../lib/haptics';
import { Icon } from '../../components/icons';
import { Sheet } from '../../components/ui';
import { useParty } from '../party/PartyContext';
import { useFilmStatus } from './useFilmStatus';

/** Beschriftung der Rastungen. Die 0 ist der Sonderfall „nächster Morgen". */
function label(h: number): string {
  return h === 0 ? 'Morgen früh' : `${h} Std.`;
}

/**
 * Entwicklungszeit und Nachschub, als Teil der Film-Karte im Album.
 *
 * Sichtbar nur für die Person, die die Runde eröffnet hat: die Zeit gilt für
 * alle, und zwei Leute, die abwechselnd daran drehen, wären das Gegenteil
 * einer gemeinsamen Kamera.
 *
 * Die Zeit stellt man selten um, deshalb nur eine Zeile mit dem Wert; die
 * Auswahl liegt dahinter in einem Sheet, wie „Erinnerung" im iOS-Kalender.
 */
export function FilmSetup() {
  const party = useParty();
  const { remaining, developAfterH, canSetup } = useFilmStatus();
  const setLocal = useFilm((s) => s.setDevelopAfterH);
  const loadRoll = useFilm((s) => s.loadRoll);
  const rolls = useFilm((s) => s.rolls);
  const [choosing, setChoosing] = useState(false);

  if (!canSetup) return null;

  const setzen = (h: number) => {
    haptic('tap');
    setLocal(h);
    party.setFilm({ developAfterH: h });
    setChoosing(false);
  };

  return (
    <>
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

      <button className="filmzeile pressable" onClick={() => setChoosing(true)}>
        <span className="grow">Entwickeln</span>
        <span className="filmzeile__wert">{label(developAfterH)}</span>
        <Icon name="chevronRight" size={17} className="list__chevron" />
      </button>

      <Sheet open={choosing} onClose={() => setChoosing(false)} title="Wann wird entwickelt?">
        <div className="stack-3">
          <p className="t-caption">Gilt für alle in der Runde, gerechnet ab Abendbeginn.</p>
          <div className="list">
            {DEVELOP_CHOICES.map((h) => (
              <button
                key={h}
                className="list__item"
                aria-pressed={h === developAfterH}
                onClick={() => setzen(h)}
              >
                <span className="grow">{label(h)}</span>
                {h === developAfterH && <Icon name="check" size={18} className="filmzeile__haken" />}
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}
