import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';
import { markTextsSeen } from '../../store/seen';
import { WaitingFor } from '../shared/pieces';
import type { GameActionInput, GamePlayer } from '../types';
import { creators, type State } from './game';
import { Label, MemeImage, MemePrint } from './Meme';
import { TopicNote } from './parts';
import { maxCharsFor, templateOf } from './templates';

/**
 * Basteln: die eigene Vorlage im Abzug, darunter ein Feld je Textstelle.
 *
 * Der Entwurf bleibt auf dem Gerät, bis „Fertig" kommt – sonst ginge bei
 * jedem Tastendruck der ganze Spielstand über die Leitung. Läuft die Uhr ab,
 * schickt das Handy selbst ab, was getippt ist.
 */
export function Editor({
  state,
  players,
  me,
  topic,
  dispatch,
}: {
  state: State;
  players: GamePlayer[];
  me: GamePlayer;
  topic: string | null;
  dispatch: (a: GameActionInput) => void;
}) {
  const templateId = state.drawn[me.id];
  const template = templateOf(templateId);
  const mine = state.memes[me.id];
  const submitted = !!mine;
  // Entwürfe je Vorlage: wer würfelt und mit „Zurück" wiederkommt, findet
  // seinen Text noch vor.
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [active, setActive] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const autoSent = useRef<string>('');

  // Neue Vorlage (Würfeln, neue Runde) = leerer Entwurf. Beim „Nochmal
  // ändern" kommt der abgeschickte Text zurück in die Felder.
  const texts = useMemo(
    () => drafts[templateId] ?? (mine && mine.t === templateId ? mine.x : []),
    [drafts, templateId, mine],
  );
  const setText = (i: number, value: string) => {
    const limit = template ? maxCharsFor(template, i) : value.length;
    const next = [...texts];
    next[i] = value.slice(0, limit);
    // Am Anschlag einmal spürbar rasten – sonst tippt man ins Leere und
    // wundert sich, warum nichts mehr kommt.
    if (value.length >= limit && (texts[i]?.length ?? 0) < limit) haptic('press');
    setDrafts((d) => ({ ...d, [templateId]: next }));
  };
  useEffect(() => setDrafts({}), [state.round]);
  const hasText = texts.some((t) => t?.trim());

  // Wer mitten in der Runde dazukommt, holt sich seine Vorlage selbst.
  useEffect(() => {
    if (!templateId) dispatch({ type: 'claim' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Fehlen
  }, [templateId]);

  // Gemerkt, damit die nächste Partie mit Vorlagen anfängt, die noch keiner kennt.
  useEffect(() => {
    if (templateId) markTextsSeen([`meme:${templateId}`]);
  }, [templateId]);

  useEffect(() => setActive(0), [templateId]);

  // Neue Runde, neue Vorlage auf dem Tisch – das soll man spüren, auch wenn
  // das Handy gerade in der Hand liegt und keiner hinschaut.
  useEffect(() => {
    haptic('heavy');
  }, [state.round]);

  // Wer noch bastelt, spürt jedes fertige Meme der anderen als leises Klopfen –
  // wie das „fertig"-Signal am Nachbartisch, ohne aufs Handy zu schauen.
  const doneCount = Object.keys(state.memes).length;
  const seenDone = useRef(doneCount);
  useEffect(() => {
    if (doneCount > seenDone.current && !submitted) haptic('tick');
    seenDone.current = doneCount;
  }, [doneCount, submitted]);

  // Die Uhr läuft ab: was getippt ist, geht raus – genau einmal je Vorlage.
  useEffect(() => {
    if (submitted || state.deadline === null) return;
    const t = setInterval(() => {
      if (Date.now() < (state.deadline ?? Infinity) - 300) return;
      const key = `${state.round}|${templateId}`;
      if (autoSent.current === key || !texts.some((x) => x?.trim())) return;
      autoSent.current = key;
      haptic('press');
      dispatch({ type: 'submit', texts });
    }, 200);
    return () => clearInterval(t);
    // `dispatch` kommt stabil aus dem Kontext; `texts` muss mit, sonst
    // schickt die Uhr den Stand vom ersten Tastendruck ab.
  }, [submitted, state.deadline, state.round, templateId, texts, dispatch]);

  if (!template) {
    return (
      <div className="notice notice--neutral">
        {templateId
          ? 'Diese Vorlage kennt deine App-Version noch nicht. Einmal neu laden holt sie.'
          : 'Deine Vorlage wird gezogen …'}
      </div>
    );
  }

  const left = state.rerolls[me.id] ?? 0;
  const same = state.options.mode === 'gleich';
  const missing = creators(state, players)
    .filter((id) => !state.memes[id])
    .map((id) => players.find((p) => p.id === id)?.name ?? '');

  const focus = (i: number) => {
    setActive(i);
    inputs.current[i]?.focus();
  };

  return (
    <div className="md-editor stack-3">
      {topic && <TopicNote text={topic} />}

      <MemePrint
        // Je Vorlage ein neuer Abzug: beim Würfeln dreht sich das Bild um.
        key={templateId}
        caption={template.name}
        className={`md-print--flip ${submitted ? 'md-print--done' : ''}`}
        tilt={-0.8}
        ar={template.w / template.h}
        badge={
          submitted ? (
            <Label tone="mint" icon="check" slap>
              Abgegeben
            </Label>
          ) : undefined
        }
      >
        <MemeImage
          template={template}
          texts={texts}
          editing={!submitted}
          active={submitted ? undefined : active}
          onBox={
            submitted
              ? undefined
              : (i) => {
                  haptic('select');
                  focus(i);
                }
          }
        />
      </MemePrint>

      {!submitted ? (
        <>
          <div className="md-fields">
            {template.boxes.map((_, i) => (
              <label key={i} className={`md-field ${active === i ? 'md-field--active' : ''}`}>
                <span className="md-field__no">{i + 1}</span>
                <input
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  className="md-field__input"
                  value={texts[i] ?? ''}
                  placeholder={template.boxes.length === 1 ? 'Dein Text' : `Text ${i + 1}`}
                  maxLength={maxCharsFor(template, i)}
                  enterKeyHint={i < template.boxes.length - 1 ? 'next' : 'done'}
                  autoComplete="off"
                  autoCorrect="on"
                  onFocus={() => setActive(i)}
                  onChange={(e) => setText(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    if (i < template.boxes.length - 1) focus(i + 1);
                    else (e.target as HTMLInputElement).blur();
                  }}
                />
              </label>
            ))}
          </div>
          <div className="md-actions">
            {!same && state.options.rerolls > 0 && (
              <>
                <button
                  className="btn btn--glass md-actions__back"
                  disabled={!state.prev[me.id]}
                  onClick={() => {
                    haptic('select');
                    dispatch({ type: 'back' });
                  }}
                  aria-label="Vorige Vorlage"
                >
                  <Icon name="undo" size={20} />
                </button>
                <button
                  className="btn btn--glass md-actions__reroll"
                  disabled={left <= 0}
                  onClick={() => {
                    haptic('select');
                    dispatch({ type: 'reroll' });
                  }}
                  aria-label={`Neue Vorlage, noch ${left}`}
                >
                  <Icon name="shuffle" size={18} />
                  Neu · {left}
                </button>
              </>
            )}
            <button
              className="btn btn--brand btn--lg grow"
              disabled={!hasText}
              onClick={() => {
                haptic('success');
                dispatch({ type: 'submit', texts });
              }}
            >
              Fertig
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            className="btn btn--glass btn--block"
            onClick={() => {
              haptic('tap');
              setDrafts((d) => ({ ...d, [templateId]: mine.x }));
              dispatch({ type: 'edit' });
            }}
          >
            <Icon name="brush" size={18} /> Nochmal ändern
          </button>
          <WaitingFor names={missing} what="Basteln noch" />
        </>
      )}
    </div>
  );
}
