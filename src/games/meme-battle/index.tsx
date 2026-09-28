import './meme.css';
import { useEffect, useRef } from 'react';
import { markTextsSeen } from '../../store/seen';
import { GameFrame } from '../shared/GameFrame';
import { BigCard } from '../shared/pieces';
import type { GameDefinition, GameRuntime } from '../types';
import { Editor } from './Editor';
import { Finale } from './Finale';
import {
  allVoted,
  createState,
  currentAuthor,
  MIN_SHOW_MS,
  reduce,
  SUBMIT_GRACE_MS,
  topicText,
  type State,
} from './game';
import { meta } from './meta';
import { TimerBar } from './parts';
import { Results } from './Results';
import { Setup } from './Setup';
import { memeUrl } from './templates';
import { VoteView } from './Vote';

export type { State } from './game';

/**
 * Hängt der Host (Handy gesperrt, App im Hintergrund), springen die anderen
 * nach dieser Zeit ein. Der Reducer nimmt nur die erste Meldung an – jede
 * trägt die Kennung des Memes, für das sie gedacht war.
 */
const FALLBACK_MS = 4_000;
/**
 * Abstand zwischen zwei gleichen Meldungen. Ohne ihn schickte jedes Gerät
 * bei schlafendem Host viermal pro Sekunde „weiter" in die Inbox – bis zur
 * Host-Übernahme nach 45 s wären das pro Handy über hundert Einträge.
 */
const RESEND_MS = { host: 1_000, guest: 3_000 };

export const memeBattle: GameDefinition<State> = {
  ...meta,
  createState: (players) => createState(players),
  reduce,
  Component: MemeBattleGame,
};

function MemeBattleGame(props: GameRuntime<State>) {
  const { state, players, me, isHost, dispatch, online, quit } = props;
  const topic = state ? topicText(state) : null;
  const author = state ? currentAuthor(state) : null;

  useEffect(() => {
    if (topic) markTextsSeen([topic]);
  }, [topic]);

  // Alle Vorlagen der Runde schon beim Basteln laden – beim Abstimmen steht
  // dann jedes Meme sofort da, statt erst aus dem Netz zu tröpfeln.
  const roundTemplates = state ? [...new Set(Object.values(state.drawn))].sort().join(',') : '';
  useEffect(() => {
    for (const id of roundTemplates.split(',').filter(Boolean)) new Image().src = memeUrl(id);
  }, [roundTemplates]);

  const lastSent = useRef(0);
  const resend = isHost ? RESEND_MS.host : RESEND_MS.guest;

  // Die Bastel-Uhr: nach Ablauf plus Gnadenfrist startet der Host die Abstimmung.
  useEffect(() => {
    if (state?.phase !== 'create' || state.deadline === null) return;
    const due = state.deadline + SUBMIT_GRACE_MS + (isHost ? 0 : FALLBACK_MS);
    const t = setInterval(() => {
      const now = Date.now();
      if (now < due || now - lastSent.current < resend) return;
      lastSent.current = now;
      dispatch({ type: 'timeout' });
    }, 300);
    return () => clearInterval(t);
  }, [state?.phase, state?.deadline, isHost, resend, dispatch]);

  // Beim Abstimmen: weiter, sobald alle abgestimmt haben und das Meme ein paar
  // Sekunden stand – spätestens, wenn die Uhr abläuft.
  const everyone = state ? allVoted(state, players) : false;
  useEffect(() => {
    if (state?.phase !== 'vote' || !author || state.deadline === null) return;
    const extra = isHost ? 0 : FALLBACK_MS;
    const t = setInterval(() => {
      const now = Date.now();
      const settled = everyone && now >= state.shownAt + MIN_SHOW_MS + 600 + extra;
      if (!settled && now < state.deadline! + extra) return;
      if (now - lastSent.current < resend) return;
      lastSent.current = now;
      dispatch({ type: 'advance', target: author });
    }, 250);
    return () => clearInterval(t);
  }, [state?.phase, state?.deadline, state?.shownAt, author, everyone, isHost, resend, dispatch]);

  if (!online) {
    return (
      <GameFrame title={meta.name} accent={meta.accent} onQuit={quit}>
        <BigCard kicker="Eigene Handys nötig">
          Beim Meme-Duell bastelt jede Person heimlich ihr eigenes Meme. Startet dafür eine
          Online-Lobby – dann hat jede Person ihre Vorlage auf dem eigenen Handy.
        </BigCard>
        <button className="btn btn--brand btn--block btn--lg" onClick={quit}>
          Zurück
        </button>
      </GameFrame>
    );
  }

  if (!state) return null;

  // Ein Spielstand aus der Zeit vor dem Umbau (Meme Battle mit Prompts) hat
  // keine Einstellungen. Läuft so eine Runde beim Update noch, lieber sauber
  // neu anfangen als an einem fremden Zustand abzustürzen.
  if (!state.options) {
    return (
      <GameFrame title={meta.name} accent={meta.accent} onQuit={quit}>
        <BigCard kicker="Neue Version">
          Das Meme-Duell wurde umgebaut. Diese Runde stammt noch aus der alten Fassung.
        </BigCard>
        <button
          className="btn btn--brand btn--block btn--lg"
          onClick={() => dispatch({ type: 'restart' })}
        >
          Neu starten
        </button>
      </GameFrame>
    );
  }

  const roundLabel = state.goal ? `Runde ${state.round}/${state.goal}` : `Runde ${state.round}`;

  if (state.phase === 'setup') {
    return (
      <GameFrame
        title={meta.name}
        accent={meta.accent}
        subtitle="Die Runde wird eingerichtet"
        onQuit={quit}
      >
        <Setup state={state} players={players} isHost={isHost} dispatch={dispatch} />
      </GameFrame>
    );
  }

  if (state.phase === 'over') {
    return (
      <GameFrame title={meta.name} accent={meta.accent} subtitle="Ausgespielt" onQuit={quit}>
        <Finale {...props} />
      </GameFrame>
    );
  }

  if (state.phase === 'create') {
    return (
      <GameFrame
        title={meta.name}
        accent={meta.accent}
        subtitle={`${roundLabel} · Basteln`}
        onQuit={quit}
      >
        {state.deadline !== null && (
          <TimerBar
            key={state.deadline}
            until={state.deadline}
            total={state.options.seconds * 1000}
            // Die letzten Sekunden spürt nur, wer noch bastelt.
            feel={!state.memes[me.id]}
          />
        )}
        <Editor state={state} players={players} me={me} topic={topic} dispatch={dispatch} />
      </GameFrame>
    );
  }

  if (state.phase === 'vote') {
    return (
      <GameFrame
        title={meta.name}
        accent={meta.accent}
        subtitle={`${roundLabel} · Abstimmen`}
        onQuit={quit}
      >
        <VoteView state={state} players={players} me={me} topic={topic} dispatch={dispatch} />
      </GameFrame>
    );
  }

  return (
    <GameFrame
      title={meta.name}
      accent={meta.accent}
      subtitle={`${roundLabel} · Auflösung`}
      onQuit={quit}
    >
      <Results state={state} players={players} me={me} topic={topic} dispatch={dispatch} />
    </GameFrame>
  );
}
