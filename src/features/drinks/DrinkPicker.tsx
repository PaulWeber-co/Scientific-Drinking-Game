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
                    <span className="avatar avatar--sm">{d.emoji}</span>
                    <span className="grow">
                      <span className="t-headline" style={{ display: 'block' }}>
                        {d.name}
                      </span>
                      <span className="t-caption">
                        {d.abvPercent} % · {alcoholPerSip(d).toFixed(1)} g pro Schluck
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
                    <span className="avatar avatar--sm">{d.emoji}</span>
                    <span className="grow">
                      <span className="t-headline" style={{ display: 'block' }}>
                        {d.name}
                      </span>
                      <span className="t-caption">
                        {d.abvPercent} % · {d.sipIsUnit ? '1 Shot' : `${d.sipSizeMl} ml`} ={' '}
                        {alcoholPerSip(d).toFixed(1)} g Alkohol
                        {!d.sipIsUnit && ` · ${sipsPerServing(d)} Schlucke pro Glas`}
                      </span>
                    </span>
                    {d.id === currentId && <span className="list__chevron">✓</span>}
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
              <div className="field">
                <span className="field__label">Name</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Omas Eierlikör" />
              </div>
              <div className="grid-2">
                <div className="field">
                  <span className="field__label">Volumen (ml)</span>
                  <input className="input" type="number" inputMode="numeric" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
                </div>
                <div className="field">
                  <span className="field__label">Vol.-%</span>
                  <input className="input" type="number" inputMode="decimal" value={abv} onChange={(e) => setAbv(Number(e.target.value))} />
                </div>
              </div>
              <div className="t-caption">
                Ergibt {((volume * abv) / 100 * 0.789).toFixed(1)} g reinen Alkohol pro Glas.
              </div>
              <button
                className="btn btn--brand btn--block"
                disabled={!name.trim() || abv <= 0}
                onClick={() => {
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
