import { useState } from 'react';
import { Icon } from '../../components/icons';
import { Sheet, Toggle } from '../../components/ui';
import { MAX_TARGET_BAC, MIN_TARGET_BAC } from '../../engine/constants';
import { DRINK_CATALOG } from '../../engine/drinks';
import { formatBac } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { useApp } from '../../store/app';
import { useCurrentDrink, usePlayer } from '../../store/player';
import type { Heat } from '../card-engine/types';

export interface HeatControl {
  value: Heat;
  onChange: (heat: Heat) => void;
}

export interface SpicyControl {
  gameId: string;
  /** true = der Stapel entsteht anderswo, hier steht nur der Hinweis darauf. */
  hostOnly?: boolean;
  /** Läuft nach dem Umschalten – baut den Stapel neu, damit es sofort wirkt. */
  onChange: () => void;
}

interface Props {
  /** Härtegrad des Spiels, falls es einen hat. */
  heat?: HeatControl;
  /** Spicy-Schalter, falls das Spiel Spicy-Karten mitbringt. */
  spicy?: SpicyControl;
}

/**
 * Was sich mitten im Abend ändert: das Getränk, der Zielpegel, wer fährt –
 * und bei Kartenspielen Härtegrad und Spicy.
 *
 * Vorher lagen diese Schalter auf drei verschiedenen Bildschirmen, die aus
 * einem laufenden Spiel alle nur über „Spiel beenden" erreichbar waren. Wer
 * von Bier auf Shots wechselt und das nicht eintragen kann, bekommt für den
 * Rest des Abends Ansagen für das falsche Getränk.
 */
export function GameSettings({ heat, spicy }: Props) {
  const [open, setOpen] = useState(false);
  const drink = useCurrentDrink();

  return (
    <>
      <button
        className="game__settings hit"
        aria-label={`Einstellungen. Getränk: ${drink.name}`}
        onClick={() => {
          haptic('tap');
          setOpen(true);
        }}
      >
        <Icon name={drink.icon} size={19} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Deine Einstellungen">
        <SettingsBody heat={heat} spicy={spicy} />
      </Sheet>
    </>
  );
}

function SettingsBody({ heat, spicy }: Props) {
  const profile = usePlayer((s) => s.profile);
  const patch = usePlayer((s) => s.patchProfile);
  const currentDrinkId = usePlayer((s) => s.currentDrinkId);
  const customDrinks = usePlayer((s) => s.customDrinks);
  const setDrink = usePlayer((s) => s.setDrink);
  const spicyOn = useApp((s) => (spicy ? s.spicy[spicy.gameId] === true : false));
  const toggleSpicy = useApp((s) => s.toggleSpicy);

  if (!profile) return null;
  const drinks = [...customDrinks, ...DRINK_CATALOG.filter((d) => d.abvPercent > 0)];

  return (
    <div className="stack">
      {profile.alcoholFree ? (
        <div className="notice notice--neutral">
          Du spielst alkoholfrei und bekommst Aufgaben statt Schlucke.
        </div>
      ) : (
        <>
          <div className="field">
            <span className="field__label">Du trinkst gerade</span>
            <div className="drinkgrid drinkgrid--compact">
              {drinks.map((d) => (
                <button
                  key={d.id}
                  className={`drinktile pressable ${d.id === currentDrinkId ? 'drinktile--on' : ''}`}
                  aria-pressed={d.id === currentDrinkId}
                  onClick={() => {
                    haptic('select');
                    setDrink(d.id);
                  }}
                >
                  <Icon name={d.icon} size={24} className="drinktile__icon" />
                  <span className="drinktile__name">{d.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="targetpick">
            <div className="t-upper">Zielpegel</div>
            <div className="targetpick__value t-mono-num">{formatBac(profile.targetBac)}</div>
            <input
              className="slider"
              type="range"
              aria-label="Zielpegel"
              min={MIN_TARGET_BAC * 100}
              max={MAX_TARGET_BAC * 100}
              step={5}
              value={profile.targetBac * 100}
              onChange={(e) => patch({ targetBac: Number(e.target.value) / 100 })}
            />
          </div>
        </>
      )}

      <div className="list">
        <div className="list__item">
          <span className="grow">
            <span className="t-headline" style={{ display: 'block' }}>
              Alkoholfrei weiterspielen
            </span>
            <span className="t-caption">Du bekommst Aufgaben statt Schlucke</span>
          </span>
          <Toggle
            checked={profile.alcoholFree}
            onChange={(alcoholFree) =>
              patch({ alcoholFree, designatedDriver: alcoholFree && profile.designatedDriver })
            }
            label="Alkoholfrei"
          />
        </div>
        <div className="list__item">
          <span className="grow">
            <span className="t-headline" style={{ display: 'block' }}>
              Ich fahre heute
            </span>
            <span className="t-caption">Sichtbar für die Runde, Wasser statt Trinkansage</span>
          </span>
          <Toggle
            checked={profile.designatedDriver}
            onChange={(designatedDriver) =>
              patch({ designatedDriver, alcoholFree: designatedDriver || profile.alcoholFree })
            }
            label="Ich fahre heute"
          />
        </div>
      </div>

      <div className="notice notice--neutral">
        Diese Angaben bleiben auf deinem Handy. Die Runde sieht nur, ob du fährst.
      </div>

      {(heat || spicy) && (
        <section className="stack-3">
          <div className="list-header t-upper">Dieses Spiel</div>
          <span className="t-caption">
            Gilt für die ganze Runde, nicht nur für dich.
          </span>
          {heat && (
            <div className="field">
              <span className="field__label">Härtegrad</span>
              <div className="segmented" role="group" aria-label="Härtegrad">
                {([1, 2, 3] as Heat[]).map((h) => (
                  <button
                    key={h}
                    className="segmented__opt"
                    aria-pressed={heat.value === h}
                    aria-label={`Härtegrad ${h}`}
                    onClick={() => {
                      haptic('select');
                      heat.onChange(h);
                    }}
                  >
                    <span className="row" style={{ gap: 2 }}>
                      {Array.from({ length: h }, (_, i) => (
                        <Icon key={i} name="flame" size={14} />
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              <span className="t-caption">
                Wirkt sofort. Die Karte darunter wird mitgetauscht, solange noch
                niemand darauf getrunken hat.
              </span>
            </div>
          )}
          {spicy && (
            <div className="list">
              <div className="list__item">
                <span className="grow">
                  <span className="t-headline" style={{ display: 'block' }}>
                    Spicy
                  </span>
                  <span className="t-caption">
                    {spicy.hostOnly
                      ? 'Den Kartenstapel stellt zusammen, wer die Runde gestartet hat. Frag dort nach.'
                      : spicyOn
                        ? 'Freizügige Karten liegen im Stapel. Kneifen geht immer.'
                        : 'Schaltet deutlich freizügigere Karten frei.'}
                  </span>
                </span>
                {spicy.hostOnly ? (
                  <Icon name="lock" size={18} />
                ) : (
                  <Toggle
                    checked={spicyOn}
                    onChange={() => {
                      haptic('select');
                      toggleSpicy(spicy.gameId);
                      spicy.onChange();
                    }}
                    label="Spicy-Karten"
                  />
                )}
              </div>
            </div>
          )}
        </section>
      )}

    </div>
  );
}
