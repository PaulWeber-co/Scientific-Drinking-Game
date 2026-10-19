import { useState } from 'react';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  DRINK_CATALOG,
  alcoholPerSip,
  createCustomDrink,
  sipsPerServing,
} from '../../engine/drinks';
import type { DrinkDefinition } from '../../engine/types';
import { Sheet } from '../../components/ui';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';
import { usePlayer } from '../../store/player';

export function DrinkPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const currentId = usePlayer((s) => s.currentDrinkId);
  const customDrinks = usePlayer((s) => s.customDrinks);
  const setDrink = usePlayer((s) => s.setDrink);
  const addCustomDrink = usePlayer((s) => s.addCustomDrink);
  const removeCustomDrink = usePlayer((s) => s.removeCustomDrink);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [volume, setVolume] = useState(300);
  const [abv, setAbv] = useState(12);
  const validVolume = Number.isFinite(volume) && volume >= 10 && volume <= 1000;
  const validAbv = Number.isFinite(abv) && abv > 0 && abv <= 60;
  const canAdd = !!name.trim() && validVolume && validAbv;

  const choose = (d: DrinkDefinition) => {
    haptic('success');
    setDrink(d.id);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Was trinkst du?">
      <div className="stack">
        {customDrinks.length > 0 && (
          <section>
            <div className="list-header t-upper">Deine Getränke</div>
            <div className="list">
              {customDrinks.map((d) => (
                <div key={d.id} className={`list__item ${d.id === currentId ? 'list__item--active' : ''}`}>
                  <button className="row grow" style={{ textAlign: 'left' }} onClick={() => choose(d)}>
                    <span className="listicon">
                      <Icon name={d.icon} size={19} />
                    </span>
                    <span className="grow">
                      <span className="t-headline" style={{ display: 'block' }}>
                        {d.name}
                      </span>
                      <span className="t-caption">
                        {d.abvPercent} % · {alcoholPerSip(d).toFixed(1).replace('.', ',')} g pro Schluck
                      </span>
                    </span>
                  </button>
                  <button className="btn btn--plain" style={{ color: 'var(--red)' }} onClick={() => removeCustomDrink(d.id)}>
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {CATEGORY_ORDER.map((cat) => {
          const items = DRINK_CATALOG.filter((d) => d.category === cat);
          if (!items.length) return null;
          return (
            <section key={cat}>
              <div className="list-header t-upper">{CATEGORY_LABEL[cat]}</div>
              <div className="list">
                {items.map((d) => (
                  <button
                    key={d.id}
                    className={`list__item ${d.id === currentId ? 'list__item--active' : ''}`}
                    onClick={() => choose(d)}
                  >
                    <span className="listicon">
                      <Icon name={d.icon} size={19} />
                    </span>
                    <span className="grow">
                      <span className="t-headline" style={{ display: 'block' }}>
                        {d.name}
                      </span>
                      <span className="t-caption">
                        {d.abvPercent} % · {d.sipIsUnit ? '1 Shot' : `${d.sipSizeMl} ml`} ={' '}
                        {alcoholPerSip(d).toFixed(1).replace('.', ',')} g Alkohol
                        {!d.sipIsUnit && ` · ${sipsPerServing(d)} Schlucke pro Glas`}
                      </span>
                    </span>
                    {d.id === currentId && (
                      <Icon name="check" size={17} strokeWidth={2.2} style={{ color: 'var(--brand)' }} />
                    )}
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        <section>
          <div className="list-header t-upper">Eigenes Getränk</div>
          {showForm ? (
            <div className="card stack-3">
              <label className="field">
                <span className="field__label">Name</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Omas Eierlikör" />
              </label>
              <div className="grid-2">
                <label className="field">
                  <span className="field__label">Volumen (ml)</span>
                  <input className="input" type="number" inputMode="numeric" min={10} max={1000} value={Number.isNaN(volume) ? '' : volume} onChange={(e) => setVolume(e.target.valueAsNumber)} />
                </label>
                <label className="field">
                  <span className="field__label">Vol.-%</span>
                  <input className="input" type="number" inputMode="decimal" min={0} max={60} step="any" value={Number.isNaN(abv) ? '' : abv} onChange={(e) => setAbv(e.target.valueAsNumber)} />
                </label>
              </div>
              {!validVolume && <p className="t-caption">Bitte ein Volumen zwischen 10 und 1000 ml eingeben.</p>}
              {!validAbv && <p className="t-caption">Bitte einen Alkoholgehalt über 0 und bis 60 Vol.-% eingeben.</p>}
              <div className="t-caption">
                Ergibt {validVolume && validAbv ? ((volume * abv) / 100 * 0.789).toFixed(1).replace('.', ',') : '–'} g reinen Alkohol pro Glas.
              </div>
              <button
                className="btn btn--brand btn--block"
                disabled={!canAdd}
                onClick={() => {
                  if (!canAdd) return;
                  const d = createCustomDrink({ name, volumeMl: volume, abvPercent: abv });
                  addCustomDrink(d);
                  haptic('success');
                  setShowForm(false);
                  setName('');
                  onClose();
                }}
              >
                Hinzufügen und auswählen
              </button>
            </div>
          ) : (
            <button className="btn btn--glass btn--block" onClick={() => setShowForm(true)}>
              + Getränk selbst anlegen
            </button>
          )}
        </section>
      </div>
    </Sheet>
  );
}
