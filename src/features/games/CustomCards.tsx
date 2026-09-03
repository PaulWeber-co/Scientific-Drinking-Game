import { useState } from 'react';
import { Icon } from '../../components/icons';
import { Segmented, Sheet } from '../../components/ui';
import { haptic } from '../../lib/haptics';
import { useCustomCards, type CustomCard } from '../../store/cards';
import type { Heat } from '../../games/card-engine/types';
import type { GameMeta } from '../../games/types';

/** Stabile Referenz: ein neues [] pro Render würde zustand in eine
 *  Endlosschleife schicken (React-Fehler 185). */
const NO_CARDS: CustomCard[] = [];

const HEAT_OPTIONS: { value: Heat; label: string }[] = [
  { value: 1, label: 'Harmlos' },
  { value: 2, label: 'Mittel' },
  { value: 3, label: 'Eskaliert' },
];

/**
 * Eigene Karten je Spiel. Sie liegen nur auf diesem Gerät; in einer Lobby
 * mischt der Host seine Karten in den Stapel – die Inhalte reisen dann mit
 * dem Spielstand, nicht als Index.
 */
export function CustomCards({ game }: { game: GameMeta }) {
  const cards = useCustomCards((s) => s.byGame[game.id] ?? NO_CARDS);
  const add = useCustomCards((s) => s.add);
  const remove = useCustomCards((s) => s.remove);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [heat, setHeat] = useState<Heat>(1);
  const [mode, setMode] = useState<string | undefined>(undefined);

  if (!game.allowCustomCards) return null;

  const submit = () => {
    if (!text.trim()) return;
    haptic('success');
    add(game.id, { text: text.trim(), heat, mode });
    setText('');
  };

  return (
    <>
      <section className="card row-between">
        <div>
          <div className="t-headline">Eigene Karten</div>
          <div className="t-caption">
            {cards.length ? `${cards.length} im Stapel` : 'Noch keine – füg eure Klassiker hinzu'}
          </div>
        </div>
        <button className="btn btn--sm btn--gray" onClick={() => setOpen(true)}>
          Bearbeiten
        </button>
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} title="Eigene Karten">
        <div className="stack">
          <div className="stack-3">
            <textarea
              className="input"
              placeholder="Text der Karte …"
              maxLength={200}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="field">
              <span className="field__label">Härtegrad</span>
              <Segmented<string>
                value={String(heat)}
                onChange={(v) => setHeat(Number(v) as Heat)}
                options={HEAT_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
              />
            </div>
            {game.modes && (
              <div className="field">
                <span className="field__label">Kategorie</span>
                <Segmented<string>
                  value={mode ?? game.modes[0].id}
                  onChange={setMode}
                  options={game.modes.map((m) => ({ value: m.id, label: m.label }))}
                />
              </div>
            )}
            <button className="btn btn--brand btn--block" disabled={!text.trim()} onClick={submit}>
              <Icon name="plus" size={17} /> Karte hinzufügen
            </button>
          </div>

          {cards.length > 0 && (
            <section>
              <div className="list-header t-upper">Deine Karten</div>
              <div className="list">
                {cards.map((c) => (
                  <div key={c.id} className="list__item">
                    <span className="grow">
                      <span className="t-body" style={{ display: 'block' }}>
                        {c.text}
                      </span>
                      <span className="t-caption">
                        {HEAT_OPTIONS.find((h) => h.value === (c.heat ?? 1))?.label}
                        {c.mode ? ` · ${game.modes?.find((m) => m.id === c.mode)?.label ?? c.mode}` : ''}
                      </span>
                    </span>
                    <button
                      className="btn btn--plain"
                      style={{ color: 'var(--red)' }}
                      aria-label="Karte löschen"
                      onClick={() => remove(game.id, c.id)}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </Sheet>
    </>
  );
}
