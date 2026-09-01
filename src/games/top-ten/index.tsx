import { Icon } from '../../components/icons';
import { useEffect, useState } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { spicyDeck } from '../shared/prompts';
import { GameFrame } from '../shared/GameFrame';
import { DrinkCallList } from '../shared/DrinkCall';
import { BigCard, PlayerChip, WaitingFor } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GameRuntime } from '../types';

interface Category {
  title: string;
  low: string;
  high: string;
  spicy?: boolean;
}

const CATEGORIES: Category[] = [
  { title: 'Ein Ort zum Uebernachten', low: '1 = Alptraum', high: '10 = Traum' },
  { title: 'Eine Ausrede für Zuspätkommen', low: '1 = erbärmlich', high: '10 = wasserdicht' },
  { title: 'Etwas, das man zum Frühstück isst', low: '1 = traurig', high: '10 = Königsfrühstück' },
  { title: 'Ein Superheld', low: '1 = nutzlos', high: '10 = allmächtig' },
  { title: 'Ein Geschenk für die Schwiegereltern', low: '1 = Beziehungsende', high: '10 = Lieblingskind' },
  { title: 'Ein Grund, das Handy wegzulegen', low: '1 = schwach', high: '10 = unumstößlich' },
  { title: 'Ein Beruf', low: '1 = ich wäre sofort raus', high: '10 = Traumjob' },
  { title: 'Ein Tier als Mitbewohner', low: '1 = Katastrophe', high: '10 = perfekt' },
  { title: 'Ein Satz im ersten Date', low: '1 = sofort weglaufen', high: '10 = Herz erobert' },
  { title: 'Ein Urlaubsziel', low: '1 = nie wieder', high: '10 = jedes Jahr' },
  { title: 'Ein Song auf einer Hochzeit', low: '1 = Stimmung tot', high: '10 = alle tanzen' },
  { title: 'Eine Sache im Kühlschrank', low: '1 = wegwerfen', high: '10 = Schatz' },
  { title: 'Ein Passwort', low: '1 = sofort gehackt', high: '10 = unknackbar' },
  { title: 'Eine Fähigkeit im Lebenslauf', low: '1 = peinlich', high: '10 = sofort eingestellt' },
  { title: 'Ein Getränk um 3 Uhr nachts', low: '1 = Fehler', high: '10 = Rettung' },
  { title: 'Ein Grund, eine Party zu verlassen', low: '1 = schwach', high: '10 = voll verständlich' },
  { title: 'Ein Film für einen verregneten Sonntag', low: '1 = schlimm', high: '10 = perfekt' },
  { title: 'Ein Name für eine Band', low: '1 = sofort auflösen', high: '10 = Welttournee' },
  { title: 'Etwas, das man nie teilen sollte', low: '1 = kein Problem', high: '10 = niemals' },
  { title: 'Eine Regel in einer WG', low: '1 = sinnlos', high: '10 = rettet den Frieden' },
  { title: 'Ein Ort für ein erstes Date', low: '1 = Desaster', high: '10 = Volltreffer' },
  { title: 'Ein Kompliment', low: '1 = beleidigend', high: '10 = schmilzt dahin' },
  { title: 'Etwas, das man an einem freien Tag macht', low: '1 = Verschwendung', high: '10 = perfekt' },
  { title: 'Eine Superkraft', low: '1 = völlig nutzlos', high: '10 = Weltherrschaft' },
  { title: 'Ein Gegenstand auf einer einsamen Insel', low: '1 = sinnlos', high: '10 = überlebenswichtig' },
  { title: 'Eine Nachricht um 2 Uhr nachts', low: '1 = sofort blockieren', high: '10 = sofort antworten' },

  // Spicy – nur im Stapel, wenn der Schalter an ist.
  { title: 'Ein Anmachspruch', low: '1 = sofort weglaufen', high: '10 = funktioniert immer', spicy: true },
  { title: 'Eine rote Flagge beim Dating', low: '1 = geschenkt', high: '10 = sofort Schluss', spicy: true },
  { title: 'Ein Geständnis an den Schwarm', low: '1 = peinlich', high: '10 = mutig', spicy: true },
  { title: 'Ein Ort für den ersten Kuss', low: '1 = Katastrophe', high: '10 = filmreif', spicy: true },
  { title: 'Eine Ausrede nach einem schlechten Date', low: '1 = durchschaubar', high: '10 = wasserdicht', spicy: true },
];

interface State {
  phase: 'writing' | 'ordering' | 'results';
  category: number;
  deck: number[];
  numbers: Record<string, number>;
  answers: Record<string, string>;
  order: string[];
  captainIndex: number;
  captainOrder: string[];
  round: number;
}

export const topTen: GameDefinition<State> = {
  id: 'top-ten',
  name: 'Top Ten',
  tagline: 'Geheime Zahl, passende Antwort. Kriegt ihr die Reihenfolge hin?',
  icon: 'ranking',
  accent: 'var(--blue)',
  minPlayers: 3,
  maxPlayers: 10,
  duration: '20-40 Min',
  intensity: 1,
  tags: ['geheim', 'kreativ', 'reden'],
  requiresOwnDevice: true,
  allowSpicy: true,
  howTo: [
    'Jede Person bekommt heimlich eine Zahl von 1 bis 10.',
    'Zur Kategorie gibt jede Person eine Antwort, die genau zu ihrer Zahl passt.',
    'Der Kapitän sortiert alle Antworten von 1 nach 10. Jeder Fehler kostet die Runde Schlucke.',
  ],

  createState: (players) => {
    const deck = spicyDeck(CATEGORIES, 'top-ten');
    const ids = players.map((p) => p.id);
    return {
      phase: 'writing',
      category: deck[0],
      deck: deck.slice(1),
      numbers: dealNumbers(ids),
      answers: {},
      order: ids,
      captainIndex: 0,
      captainOrder: [],
      round: 1,
    };
  },

  reduce: (state, action, players) => {
    const active = players.filter((p) => p.online !== false).map((p) => p.id);
    switch (action.type) {
      case 'submit': {
        if (state.phase !== 'writing') return state;
        const text = String(action.text ?? '').slice(0, 120).trim();
        if (!text) return state;
        const answers = { ...state.answers, [action.by]: text };
        const done = active.every((id) => answers[id]);
        return {
          ...state,
          answers,
          phase: done ? 'ordering' : 'writing',
          captainOrder: done ? shuffle(Object.keys(answers)) : state.captainOrder,
        };
      }
      case 'setOrder':
        return { ...state, captainOrder: (action.order as string[]) ?? state.captainOrder };
      case 'lockOrder':
        return { ...state, phase: 'results' };
      case 'next': {
        const deck = state.deck.length ? state.deck : spicyDeck(CATEGORIES, 'top-ten');
        const ids = players.map((p) => p.id);
        return {
          ...state,
          phase: 'writing',
          category: deck[0],
          deck: deck.slice(1),
          numbers: dealNumbers(ids),
          answers: {},
          order: ids,
          captainOrder: [],
          captainIndex: (state.captainIndex + 1) % Math.max(1, ids.length),
          round: state.round + 1,
        };
      }
      default:
        return state;
    }
  },

  Component: TopTenGame,
};

/** Zieht für jede Person eine eindeutige Zahl aus 1..10. */
function dealNumbers(ids: string[]): Record<string, number> {
  const pool = shuffle(Array.from({ length: 10 }, (_, i) => i + 1));
  return Object.fromEntries(ids.map((id, i) => [id, pool[i % 10]]));
}

function TopTenGame({ state, players, me, dispatch, quit, online }: GameRuntime<State>) {
  const [draft, setDraft] = useState('');
  const [local, setLocal] = useState<string[]>(state.captainOrder);
  useEffect(() => setLocal(state.captainOrder), [state.captainOrder]);

  const send = (a: GameActionInput) => dispatch(a);
  const byId = (id: string) => players.find((p) => p.id === id);
  const cat = CATEGORIES[state.category];
  const captain = players[state.captainIndex % Math.max(1, players.length)];
  const isCaptain = captain?.id === me.id;

  if (!online) {
    return (
      <GameFrame title={topTen.name} accent={topTen.accent} onQuit={quit}>
        <BigCard kicker="Eigene Handys nötig">
          Bei Top Ten kennt niemand die Zahl der anderen. Startet dafür eine Online-Lobby.
        </BigCard>
        <button className="btn btn--brand btn--block btn--lg" onClick={quit}>
          Zurück
        </button>
      </GameFrame>
    );
  }

  if (state.phase === 'writing') {
    const myNumber = state.numbers[me.id];
    const submitted = !!state.answers[me.id];
    const waiting = players.filter((p) => p.online !== false && !state.answers[p.id]).map((p) => p.name);
    return (
      <GameFrame title={topTen.name} accent={topTen.accent} subtitle={`Runde ${state.round}`} onQuit={quit}>
        <BigCard kicker={cat.low + ' → ' + cat.high}>{cat.title}</BigCard>
        <div className="secret">
          <div className="t-upper">Deine geheime Zahl</div>
          <div className="secret__num t-mono-num">{myNumber ?? '–'}</div>
          <div className="t-caption">Zeig sie niemandem.</div>
        </div>
        {submitted ? (
          <WaitingFor names={waiting} what="Warten auf" />
        ) : (
          <div className="stack-3">
            <textarea
              className="input"
              placeholder="Antwort, die genau zu deiner Zahl passt …"
              maxLength={120}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              className="btn btn--brand btn--block"
              disabled={!draft.trim()}
              onClick={() => {
                haptic('success');
                send({ type: 'submit', text: draft });
                setDraft('');
              }}
            >
              Abschicken
            </button>
          </div>
        )}
      </GameFrame>
    );
  }

  if (state.phase === 'ordering') {
    const move = (i: number, dir: -1 | 1) => {
      const next = [...local];
      const j = i + dir;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j], next[i]];
      setLocal(next);
      haptic('tap');
      send({ type: 'setOrder', order: next });
    };
    return (
      <GameFrame title={topTen.name} accent={topTen.accent} subtitle="Sortieren" onQuit={quit}>
        <div className="row" style={{ justifyContent: 'center' }}>
          {captain && <PlayerChip player={captain} note={isCaptain ? 'du sortierst' : 'sortiert'} />}
        </div>
        <BigCard kicker={cat.low + ' → ' + cat.high}>{cat.title}</BigCard>
        <div className="stack-2">
          {local.map((id, i) => (
            <div key={id} className="result-row">
              <div className="result-row__rank">{i + 1}</div>
              <div className="grow t-headline">{state.answers[id]}</div>
              {isCaptain && (
                <div className="stack-2" style={{ gap: 4 }}>
                  <button className="btn btn--gray btn--sm" onClick={() => move(i, -1)} aria-label="nach oben">
                    <Icon name="chevronUp" size={15} strokeWidth={2.2} />
                  </button>
                  <button className="btn btn--gray btn--sm" onClick={() => move(i, 1)} aria-label="nach unten">
                    <Icon name="chevronDown" size={15} strokeWidth={2.2} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {isCaptain ? (
          <button
            className="btn btn--brand btn--block btn--lg"
            onClick={() => {
              haptic('warn');
              send({ type: 'lockOrder' });
            }}
          >
            Reihenfolge festlegen
          </button>
        ) : (
          <div className="t-center t-sub">Redet mit. Nur {captain?.name} kann verschieben.</div>
        )}
      </GameFrame>
    );
  }

  const truth = [...local].sort((a, b) => (state.numbers[a] ?? 0) - (state.numbers[b] ?? 0));
  let wrongPairs = 0;
  for (let i = 0; i < local.length - 1; i++) {
    if ((state.numbers[local[i]] ?? 0) > (state.numbers[local[i + 1]] ?? 0)) wrongPairs++;
  }
  const perfect = wrongPairs === 0;
  const others = players.filter((p) => p.id !== captain?.id);

  return (
    <GameFrame title={topTen.name} accent={topTen.accent} subtitle="Auflösung" onQuit={quit}>
      <BigCard kicker={perfect ? 'Perfekt' : `${wrongPairs} ${wrongPairs === 1 ? 'Fehler' : 'Fehler'}`}>
        {perfect
          ? `${captain?.name} hat alles richtig sortiert. Alle anderen trinken.`
          : 'Nicht ganz. Die Runde zahlt drauf.'}
      </BigCard>
      <div className="stack-2">
        {truth.map((id) => (
          <div key={id} className="result-row">
            <div className="result-row__rank">{state.numbers[id]}</div>
            <div className="grow">
              <div className="t-headline">{state.answers[id]}</div>
              <div className="t-caption">
                {byId(id)?.name} · dein Platz {local.indexOf(id) + 1}
              </div>
            </div>
          </div>
        ))}
      </div>
      <DrinkCallList
        players={perfect ? others : players}
        baseSips={perfect ? 3 : Math.min(6, wrongPairs + 1)}
        source="top-ten"
      />
      <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
        Nächste Runde
      </button>
    </GameFrame>
  );
}
