import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';
import { markTextsSeen } from '../../store/seen';
import { WaitingFor } from '../shared/pieces';
import type { GameActionInput, GamePlayer } from '../types';
import { creators, rerollScopeOf, type State } from './game';
import { Label, MemeImage, MemePrint } from './Meme';
import { TopicNote } from './parts';
import { maxCharsFor, templateOf } from './templates';

interface Drafts {
  textsByTemplate: Record<string, string[]>;
  editedAfterSubmit: boolean;
}

const draftStoragePrefix = (id: string) => `pegel.meme-draft:${id}:`;

export function draftStorageKey(id: string, round: number, deadline: number | null) {
  return `${draftStoragePrefix(id)}${round}:${deadline}`;
}

export function clearOldDrafts(id: string, keepKey: string | null) {
  const prefix = draftStoragePrefix(id);
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix) && key !== keepKey) localStorage.removeItem(key);
    }
  } catch {
    // Der Editor funktioniert auch ohne lokalen Speicher.
  }
}

function readDrafts(key: string): Drafts {
  try {
    const drafts = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (drafts?.textsByTemplate && typeof drafts.textsByTemplate === 'object') {
      const textsByTemplate: Record<string, string[]> = Object.fromEntries(
        Object.entries(drafts.textsByTemplate).filter(
          (entry): entry is [string, string[]] =>
            Array.isArray(entry[1]) && entry[1].every((text) => typeof text === 'string'),
        ),
      );
      return { textsByTemplate, editedAfterSubmit: drafts.editedAfterSubmit === true };
    }
  } catch {
    // Fehlende Speicherrechte oder kaputte Daten blockieren das Basteln nicht.
  }
  return { textsByTemplate: {}, editedAfterSubmit: false };
}

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
  const storageKey = draftStorageKey(me.id, state.round, state.deadline);
  const [drafts, setDrafts] = useState(() => readDrafts(storageKey));
  const [active, setActive] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const autoSent = useRef<string>('');
  const [expiredDeadline, setExpiredDeadline] = useState<number | null>(null);
  const timeUp =
    state.deadline !== null && (expiredDeadline === state.deadline || Date.now() >= state.deadline);
  useEffect(() => {
    if (state.deadline === null) return;
    const deadline = state.deadline;
    const t = setTimeout(() => setExpiredDeadline(deadline), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(t);
  }, [state.deadline]);

  // Neue Vorlage (Würfeln, neue Runde) = leerer Entwurf. Beim „Nochmal
  // ändern" kommt der abgeschickte Text zurück in die Felder.
  const texts = useMemo(
    () => (mine && mine.t === templateId ? mine.x : (drafts.textsByTemplate[templateId] ?? [])),
    [drafts, templateId, mine],
  );
  const saveDraft = (texts: string[], editedAfterSubmit = drafts.editedAfterSubmit) => {
    const next = { textsByTemplate: { ...drafts.textsByTemplate, [templateId]: texts }, editedAfterSubmit };
    setDrafts(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Der Entwurf bleibt im Editor, falls der Speicher nicht verfügbar ist.
    }
  };
  const setText = (i: number, value: string) => {
    const limit = template ? maxCharsFor(template, i) : value.length;
    const next = Array.from({ length: Math.max(texts.length, i + 1) }, (_, j) => texts[j] ?? '');
    next[i] = value.slice(0, limit);
    // Am Anschlag einmal spürbar rasten – sonst tippt man ins Leere und
    // wundert sich, warum nichts mehr kommt.
    if (value.length >= limit && (texts[i]?.length ?? 0) < limit) haptic('press');
    saveDraft(next);
  };
  const hasText = texts.some((t) => t?.trim());

  // Wer mitten in der Runde dazukommt, holt sich seine Vorlage selbst.
  useEffect(() => {
    if (!templateId) dispatch({ type: 'claim', round: state.round });
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
      if (Date.now() < (state.deadline ?? Infinity)) return;
      const key = `${state.round}|${templateId}`;
      if (autoSent.current === key || !texts.some((x) => x?.trim())) return;
      autoSent.current = key;
      haptic('press');
      dispatch({ type: 'submit', texts, round: state.round, template: templateId });
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
                  disabled={timeUp}
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
                  disabled={timeUp || !state.prev[me.id]}
                  onClick={() => {
                    haptic('select');
                    dispatch({ type: 'back', round: state.round, template: templateId });
                  }}
                  aria-label="Vorige Vorlage"
                >
                  <Icon name="undo" size={20} />
                </button>
                <button
                  className="btn btn--glass md-actions__reroll"
                  disabled={timeUp || left <= 0}
                  onClick={() => {
                    haptic('select');
                    dispatch({ type: 'reroll', round: state.round, template: templateId });
                  }}
                  aria-label={`Vorlage wechseln, noch ${left} ${rerollScopeOf(state.options) === 'round' ? 'in dieser Runde' : 'im ganzen Spiel'}`}
                >
                  <Icon name="shuffle" size={18} />
                  Wechseln · {left}
                </button>
              </>
            )}
            <button
              className="btn btn--brand btn--lg grow"
              disabled={!hasText || timeUp}
              onClick={() => {
                haptic('success');
                dispatch({ type: 'submit', texts, round: state.round, template: templateId });
              }}
            >
              Fertig
            </button>
          </div>
          {state.round === 1 && !drafts.editedAfterSubmit && (
            <p className="t-caption t-center">
              Sobald alle fertig sind, beginnt die Abstimmung. Bis dahin kannst du noch ändern.
            </p>
          )}
        </>
      ) : (
        <>
          <button
            className="btn btn--glass btn--block"
            disabled={timeUp}
            onClick={() => {
              haptic('tap');
              saveDraft(mine.x, true);
              dispatch({ type: 'edit', round: state.round, template: templateId });
            }}
          >
            <Icon name="brush" size={18} /> Nochmal ändern
          </button>
          <WaitingFor names={missing} what="Basteln noch" />
        </>
      )}
      {!same && state.options.rerolls > 0 && !submitted && (
        <p className="t-caption t-center">
          {left} Vorlagenwechsel{' '}
          {rerollScopeOf(state.options) === 'round' ? 'in dieser Runde' : 'im ganzen Spiel'} übrig.
          {state.prev[me.id]
            ? ' Die vorige Vorlage kannst du kostenlos zurückholen; ihr Text bleibt erhalten.'
            : ''}
        </p>
      )}
      {timeUp && !submitted && (
        <p className="notice notice--neutral" role="status">
          Zeit vorbei.{' '}
          {hasText
            ? 'Dein Meme wird abgegeben …'
            : 'Du hast keinen Text eingegeben. Gleich geht die Abstimmung los.'}
        </p>
      )}
    </div>
  );
}
