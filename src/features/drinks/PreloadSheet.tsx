import { useState } from 'react';
import { Segmented, Sheet, Stepper } from '../../components/ui';
import { sipsPerServing } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';
import { haptic } from '../../lib/haptics';
import { useCurrentDrink, usePlayer } from '../../store/player';

/** Wie lange das Vorglühen her ist. Werte in Stunden, als Text für `Segmented`. */
const AGO: { value: string; label: string }[] = [
  { value: '0.5', label: 'gerade' },
  { value: '1', label: '1 Std' },
  { value: '2', label: '2 Std' },
  { value: '4', label: '4 Std+' },
];

const HOUR_MS = 60 * 60 * 1000;

/**
 * Was vor dem Start schon getrunken war.
 *
 * Ohne diese Frage beginnt jede Runde bei null Promille, und die App sagt
 * dem, der seit drei Stunden trinkt, dieselbe Menge an wie dem, der gerade
 * erst gekommen ist.
 *
 * Der Zeitpunkt zählt mehr als die Menge: zwei Stunden Versatz verschieben
 * die Schätzung um rund 0,3 Promille, ein halbes Glas mehr oder weniger um
 * ein Vielfaches weniger. Deshalb Gläser in ganzen Schritten, Zeit in vier
 * groben Stufen, und keine Tastatur.
 *
 * Die Gläser werden über das Fenster VERTEILT statt auf einen Zeitpunkt
 * gelegt — sonst behauptet die Kurve einen Rausch, den es so nie gab.
 */
export function PreloadSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const drink = useCurrentDrink();
  const logEvent = usePlayer((s) => s.logEvent);
  const markPreloadAsked = usePlayer((s) => s.markPreloadAsked);
  const [glasses, setGlasses] = useState(1);
  const [ago, setAgo] = useState('1');

  const close = () => {
    markPreloadAsked();
    onClose();
  };

  const apply = () => {
    const per = sipsPerServing(drink);
    const span = Number(ago) * HOUR_MS;
    const now = Date.now();
    haptic('success');
    for (let i = 0; i < glasses; i++) {
      logEvent(makeDrinkEvent(drink, per, 'vorher', Math.round(now - span + (span / glasses) * i)));
    }
    setGlasses(1);
    close();
  };

  return (
    <Sheet open={open} onClose={close} title="Schon was getrunken?">
      <div className="stack-3">
        <div className="t-caption">
          Damit die App weiß, wo du stehst. Grob reicht – {drink.name} ist eingestellt.
        </div>

        <Stepper
          value={glasses}
          onChange={setGlasses}
          min={1}
          max={12}
          unit={glasses === 1 ? 'Glas' : 'Gläser'}
        />

        <div className="list-header t-upper">Seit wann</div>
        <Segmented value={ago} options={AGO} onChange={setAgo} />

        <button className="btn btn--brand btn--block btn--lg" onClick={apply}>
          Eintragen
        </button>
        <button className="btn btn--glass btn--block" onClick={close}>
          Noch nichts getrunken
        </button>
      </div>
    </Sheet>
  );
}
