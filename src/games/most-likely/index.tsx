import { useEffect } from 'react';
import { haptic } from '../../lib/haptics';
import { markTextsSeen } from '../../store/seen';
import { spicyDeck } from '../shared/prompts';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { DrinkCallList } from '../shared/DrinkCall';
import { BigCard, FingerTally, VoteGrid, VoteResult, WaitingFor } from '../shared/pieces';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { meta } from './meta';

interface Prompt {
  text: string;
  spicy?: boolean;
}

const PROMPTS: Prompt[] = [
  { text: 'Wer aus der Runde verpasst am ehesten den Flug?' },
  { text: 'Wer würde am ehesten seinen eigenen Geburtstag vergessen?' },
  { text: 'Wer redet im Schlaf?' },
  { text: 'Wer würde am ehesten eine Sekte gründen?' },
  { text: 'Wer schreibt die längsten Sprachnachrichten?' },
  { text: 'Wer würde bei einer Zombie-Apokalypse zuerst draufgehen?' },
  { text: 'Wer hat den chaotischsten Kleiderschrank?' },
  { text: 'Wer würde am ehesten aus Versehen die Polizei rufen?' },
  { text: 'Wer wird als Erstes heiraten?' },
  { text: 'Wer könnte am längsten ohne Handy überleben?' },
  { text: 'Wer würde am ehesten für Geld im Fernsehen auftreten?' },
  { text: 'Wer hat die peinlichste Musik auf dem Handy?' },
  { text: 'Wer weint am ehesten bei einem Film?' },
  { text: 'Wer würde am ehesten einen Marathon spontan mitlaufen?' },
  { text: 'Wer kommt immer zu spät?' },
  { text: 'Wer würde am ehesten ein Haustier nach sich selbst benennen?' },
  { text: 'Wer könnte am besten lügen, ohne rot zu werden?' },
  { text: 'Wer würde am ehesten in eine Touristenfalle tappen?' },
  { text: 'Wer gibt am meisten Geld für Unnötiges aus?' },
  { text: 'Wer wäre der beste Tatort-Kommissar?' },
  { text: 'Wer hat den schlechtesten Orientierungssinn?' },
  { text: 'Wer würde am ehesten seinen Chef versehentlich duzen?' },
  { text: 'Wer wird heute Abend als Erstes müde?' },
  { text: 'Wer würde am ehesten mit Fremden auf einer Hochzeit landen?' },
  { text: 'Wer hat die meisten ungelesenen Mails?' },
  { text: 'Wer würde am ehesten eine Wette verlieren und trotzdem behaupten zu gewinnen?' },
  { text: 'Wer wäre am ehesten in einer Reality-Show?' },
  { text: 'Wer räumt nach der Party auf?' },
  { text: 'Wer erzählt dieselbe Geschichte am häufigsten?' },
  { text: 'Wer würde am ehesten seinen Schlüssel im Kühlschrank finden?' },
  { text: 'Wer ist heimlich am ehrgeizigsten?' },
  { text: 'Wer würde am ehesten ohne Plan auswandern?' },

  { text: 'Wer würde bei einer Diskussion den eigenen Standpunkt googeln?' },
  { text: 'Wer verschickt am ehesten einen Screenshot an die Person darauf?' },
  { text: 'Wer winkt am ehesten zurück, obwohl jemand anders gemeint war?' },
  { text: 'Wer würde bei einer Ausrede am schnellsten ins Schwitzen kommen?' },
  { text: 'Wer bestellt etwas und bereut es, sobald das Essen der anderen kommt?' },
  { text: 'Wer würde am ehesten beim Verlassen eines Ladens den Alarm auslösen?' },
  { text: 'Wer übt eine Beschwerde und sagt dann doch nur „Alles super“?' },
  { text: 'Wer würde am ehesten im falschen Gruppenchat lästern?' },
  { text: 'Wer hält eine Zimmerpflanze am kürzesten am Leben?' },
  { text: 'Wer würde beim Versteckspiel als Erstes kichern?' },
  { text: 'Wer kündigt am ehesten eine große Veränderung an und vergisst sie morgen?' },
  { text: 'Wer würde bei einem Quiz mit voller Überzeugung die falsche Antwort geben?' },
  { text: 'Wer liest am ehesten heimlich die Speisekarte der Nachbartische mit?' },
  { text: 'Wer würde im Urlaub den Koffer auf dem Flughafenboden umpacken?' },
  { text: 'Wer tut am ehesten so, als wäre eine Nachricht nie angekommen?' },
  { text: 'Wer würde beim Karaoke den Text erfinden und so tun, als gehöre er dazu?' },
  { text: 'Wer nimmt am ehesten ein Hotelhandtuch als Souvenir mit?' },
  { text: 'Wer würde am ehesten eine Überraschungsparty versehentlich verraten?' },
  { text: 'Wer ist am ehesten der Grund für eine neue WG-Regel?' },
  { text: 'Wer würde beim Online-Einkauf für den Gratisversand mehr ausgeben?' },
  { text: 'Wer würde am ehesten eine Diskussion mit „Nur mal angenommen“ eskalieren lassen?' },
  { text: 'Wer sucht am längsten nach einer Brille, die schon auf der Nase sitzt?' },
  { text: 'Wer würde bei einem Escape Room am ehesten den Notausgang nehmen?' },
  { text: 'Wer erzählt am ehesten einen Witz und lacht allein darüber?' },
  { text: 'Wer würde eine Pizza reklamieren und dabei selbst das falsche Restaurant anrufen?' },
  { text: 'Wer würde am ehesten bei einem Tanzkreis in der Mitte landen?' },
  { text: 'Wer kontrolliert am häufigsten, ob die Tür wirklich abgeschlossen ist?' },
  { text: 'Wer würde am ehesten einen Wecker ausschalten und behaupten, er habe nicht geklingelt?' },
  { text: 'Wer würde bei einer Talentshow mit einem völlig nutzlosen Talent antreten?' },
  { text: 'Wer macht am ehesten aus einer Kleinigkeit eine Familiengeschichte für Jahre?' },
  { text: 'Wer würde im Streit am ehesten alte Chatverläufe als Beweis vorlegen?' },
  { text: 'Wer würde am ehesten den eigenen Namen bei einer Bestellung falsch verstehen?' },
  { text: 'Wer würde beim Umzug am ehesten verschwinden, sobald die Waschmaschine dran ist?' },
  { text: 'Wer hat am ehesten eine Schublade voller Kabel ohne passenden Anschluss?' },
  { text: 'Wer würde aus Versehen einen Videoanruf mit eingeschalteter Kamera betreten?' },
  { text: 'Wer würde am ehesten beim Friseur nicken und zu Hause über den Schnitt schimpfen?' },
  { text: 'Wer würde am ehesten einen Geburtstag mit einer hastig gekauften Tankstellenkarte retten?' },
  { text: 'Wer würde in der Bahn am ehesten an der falschen Haltestelle selbstbewusst aussteigen?' },
  { text: 'Wer würde am ehesten bei einem Spiel die Regeln erst nach der Niederlage lesen?' },
  { text: 'Wer macht aus einem kurzen Einkauf am ehesten einen zweistündigen Ausflug?' },
  { text: 'Wer würde beim Verabschieden am ehesten in die gleiche Richtung weiterlaufen?' },
  { text: 'Wer würde am ehesten eine fremde Jacke mit nach Hause nehmen?' },
  { text: 'Wer würde beim Kochen am ehesten den Rauchmelder zum Mitsingen bringen?' },
  { text: 'Wer würde am ehesten einen Termin erfinden, um früher zu gehen?' },
  { text: 'Wer würde beim Sport am ehesten mehr über die Kleidung als über das Training reden?' },
  { text: 'Wer hätte als Kind am ehesten die Hausaufgaben vom Hund fressen lassen?' },
  { text: 'Wer würde bei einer Preisverleihung die längste Dankesrede halten?' },
  { text: 'Wer würde am ehesten ein Geheimnis mit „Sag es aber niemandem“ weitergeben?' },
  { text: 'Wer würde am ehesten ein Möbelstück mit übrig gebliebenen Schrauben aufbauen?' },
  { text: 'Wer würde auf einer Party am ehesten den Kühlschrank nach Mitternacht plündern?' },
  { text: 'Wer würde am ehesten ein Lied falsch mitsingen und andere korrigieren?' },
  { text: 'Wer würde am ehesten eine Nachricht dreimal löschen und dann „ok“ schreiben?' },
  { text: 'Wer würde am ehesten beim Ausmisten plötzlich alte Tagebücher vorlesen?' },
  { text: 'Wer wäre am ehesten auf einem Familienfoto mit geschlossenen Augen zu sehen?' },
  { text: 'Wer würde am ehesten eine peinliche Geschichte über sich selbst versehentlich bestätigen?' },
  { text: 'Wer würde am ehesten bei einer Panne zuerst ein Foto machen?' },
  { text: 'Wer würde bei einer Verkleidungsparty am ehesten als einzige Person verkleidet erscheinen?' },
  { text: 'Wer würde am ehesten eine fremde Geschichte als eigene Anekdote erzählen?' },
  { text: 'Wer würde beim Spieleabend am ehesten heimlich die Punkte nachzählen?' },
  { text: 'Wer würde am ehesten eine Woche lang eine neue Leidenschaft zur Persönlichkeit machen?' },
  { text: 'Wer würde am ehesten auf der eigenen Geburtstagsparty als Erstes einschlafen?' },
  { text: 'Wer würde am ehesten einen Witz erklären, bis niemand mehr lacht?' },
  { text: 'Wer würde am ehesten mit einem Einkaufswagen gegen ein Regal fahren?' },
  { text: 'Wer würde am ehesten eine Sprachnachricht mehrfach aufnehmen und trotzdem nuscheln?' },
  { text: 'Wer würde am ehesten eine Einladung vergessen und plötzlich vor verschlossener Tür stehen?' },
  { text: 'Wer würde am ehesten bei einer Stadtrundfahrt einschlafen?' },
  { text: 'Wer würde am ehesten ein Paket zur Abholung bestellen und nie abholen?' },
  { text: 'Wer würde am ehesten einen uralten Gutschein an der Kasse verteidigen?' },
  { text: 'Wer würde am ehesten ein Haustier um Rat fragen?' },
  { text: 'Wer würde am ehesten bei einer Diskussion versehentlich auf Stummschaltung reden?' },
  { text: 'Wer würde am ehesten einen fremden Namen auf einem Kaffeebecher akzeptieren?' },
  { text: 'Wer würde sich am ehesten nach einer Krimiserie für einen Ermittlungsprofi halten?' },
  { text: 'Wer würde am ehesten beim Flüstern durch den ganzen Raum zu hören sein?' },
  { text: 'Wer würde am ehesten ein Kleidungsstück mit Etikett den ganzen Tag tragen?' },
  { text: 'Wer würde am ehesten bei einer Feier die falsche Kerze ausblasen?' },
  { text: 'Wer würde am ehesten eine Nachricht mit „Bin unterwegs“ schreiben und noch im Bett liegen?' },
  { text: 'Wer würde am ehesten aus einer Mücke ein dreistündiges Telefonat machen?' },
  { text: 'Wer würde am ehesten im Urlaub mit Sonnenbrand die Sonnencreme suchen?' },
  { text: 'Wer würde am ehesten bei einer Prüfung den eigenen Namen vergessen?' },
  { text: 'Wer würde am ehesten einen fremden Hund überschwänglich begrüßen und den Menschen ignorieren?' },
  { text: 'Wer würde am ehesten einen Streit mit einem Sprachassistenten verlieren?' },
  { text: 'Wer würde am ehesten beim Abschied aus Versehen „Hab dich lieb“ sagen?' },
  { text: 'Wer würde am ehesten beim gemeinsamen Foto nach zehn Versuchen noch Änderungen verlangen?' },

  // Spicy – nur im Stapel, wenn der Schalter an ist.
  { text: 'Wer flirtet am ehesten mit der Bedienung?', spicy: true },
  { text: 'Wer hat den mutigsten Anmachspruch drauf?', spicy: true },
  { text: 'Wer würde am ehesten den Ex zurücknehmen?', spicy: true },
  { text: 'Wer verliebt sich am schnellsten?', spicy: true },
  { text: 'Wer hat die meisten ungelesenen Dating-Nachrichten?', spicy: true },
  { text: 'Wer würde am ehesten eine Fernbeziehung wirklich durchziehen?', spicy: true },
  { text: 'Wer hat den peinlichsten Flirt-Move?', spicy: true },
  { text: 'Wer würde auf einer fremden Hochzeit als Erstes tanzen?', spicy: true },
  { text: 'Wer ist heimlich in jemanden aus dem Freundeskreis verliebt?', spicy: true },
  { text: 'Wer würde am ehesten eine Nummer auf einen Bierdeckel schreiben?', spicy: true },
  { text: 'Wer würde am ehesten beim Flirten versehentlich den falschen Namen sagen?', spicy: true },
  { text: 'Wer würde am ehesten ein altes Flirtfoto um drei Uhr nachts liken?', spicy: true },
  { text: 'Wer würde am ehesten nach einem Kuss erst mal den Namen erfragen?', spicy: true },
  { text: 'Wer würde am ehesten ein Date mit einer erfundenen Ausrede vorzeitig verlassen?', spicy: true },
  { text: 'Wer würde am ehesten aus Eifersucht ein Profil bis zum ersten Beitrag durchforsten?', spicy: true },
  { text: 'Wer würde am ehesten ein Date zum falschen Treffpunkt schicken?', spicy: true },
  { text: 'Wer würde am ehesten beim Flirten über die eigenen Füße stolpern?', spicy: true },
  { text: 'Wer würde am ehesten ein Date nach fünf Minuten der ganzen Runde vorstellen?', spicy: true },
  { text: 'Wer würde am ehesten einen Kuss ankündigen und dann die Gelegenheit verpassen?', spicy: true },
  { text: 'Wer würde am ehesten ein Date mit einem unfreiwilligen Familienbesuch überraschen?', spicy: true },
  { text: 'Wer würde am ehesten eine Flirtnachricht an die Familiengruppe schicken?', spicy: true },
  { text: 'Wer würde am ehesten beim Date behaupten, ein Hobby zu teilen, und sofort auffliegen?', spicy: true },
  { text: 'Wer würde am ehesten nach einem Date den Chat mit der Runde auswerten?', spicy: true },
  { text: 'Wer würde am ehesten ein Date mit einem schlechten Wortspiel vertreiben?', spicy: true },
  { text: 'Wer würde am ehesten beim Knutschen den eigenen Wecker klingeln lassen?', spicy: true },
  { text: 'Wer würde am ehesten ein Date googeln und sich dabei versehentlich verplappern?', spicy: true },
  { text: 'Wer würde am ehesten einen Korb bekommen und ihn für einen Flirt halten?', spicy: true },
  { text: 'Wer würde am ehesten den Ex auf einer Party demonstrativ übersehen und gegen eine Tür laufen?', spicy: true },
  { text: 'Wer würde am ehesten nach einem Kuss sofort von einer gemeinsamen Zukunft reden?', spicy: true },
  { text: 'Wer würde am ehesten bei einem Date die Rechnung der falschen Person bezahlen?', spicy: true },
  { text: 'Wer würde am ehesten ein Dating-Profil mit einem Foto aus der Schulzeit schmücken?', spicy: true },
  { text: 'Wer würde am ehesten nach einem Date versehentlich die falsche Person nach Hause begleiten?', spicy: true },
  { text: 'Wer würde am ehesten aus einem harmlosen Kompliment eine Liebeserklärung heraushören?', spicy: true },
  { text: 'Wer würde am ehesten beim Date so tun, als kenne sie oder er den Lieblingsfilm des Gegenübers?', spicy: true },
  { text: 'Wer würde am ehesten nach einer gemeinsamen Nacht mit zwei verschiedenen Socken auftauchen?', spicy: true },
];

interface State {
  phase: 'vote' | 'result' | 'over';
  prompt: number;
  deck: number[];
  /**
   * Stimme -> Ziel. Im Online-Modus ein Eintrag pro Spielgerät. Auf einem
   * geteilten Handy trägt `countVotes` mehrere Finger auf einmal ein, dafür
   * unter erfundenen Schlüsseln (`@0`, `@1`, ...) – Auszählung und Statistik
   * darunter bleiben dieselbe Funktion wie im Online-Modus.
   */
  votes: Record<string, string>;
  round: number;
  /** Ziellinie in Fragen. `null` heißt: ohne Ende. */
  goal: number | null;
  /** Stimmen über die ganze Partie, aus allen ausgezählten Runden. */
  tally: Record<string, number>;
}

export const mostLikely: GameDefinition<State> = {
  ...meta,

  createState: (players) => {
    const deck = spicyDeck(PROMPTS, 'most-likely', (p) => p.text, players.length);
    return {
      phase: 'vote',
      prompt: deck[0],
      deck: deck.slice(1),
      votes: {},
      round: 1,
      // Eine Runde ist eine Frage. Sechs davon reichen, damit jeder ein paar
      // Mal gemeint war, bevor sich die Fragen abnutzen.
      goal: roundGoal(baseFor('most-likely')),
      tally: {},
    };
  },

  reduce: (state, action, players) => {
    const active = players.filter((p) => p.online !== false).map((p) => p.id);
    switch (action.type) {
      case 'vote': {
        if (state.phase !== 'vote') return state;
        const votes = { ...state.votes, [action.by]: String(action.target) };
        const done = active.every((id) => votes[id]);
        if (!done) return { ...state, votes };
        // Die Runde ist ausgezählt – erst jetzt zählen ihre Stimmen für die Wertung.
        const tally = { ...state.tally };
        for (const id of Object.values(votes)) tally[id] = (tally[id] ?? 0) + 1;
        return { ...state, votes, phase: 'result', tally };
      }
      case 'countVotes': {
        // Ein geteiltes Handy: alle zeigen auf drei gleichzeitig, danach
        // trägt die Person mit dem Handy ein, wie viele Finger wer bekam.
        // Jeder Finger wird als eigene Stimme unter einem erfundenen
        // Schlüssel verbucht, damit diese Runde exakt so ausgezählt wird
        // wie eine Online-Runde mit echten Stimmen je Gerät.
        if (state.phase !== 'vote') return state;
        const raw = (action.counts as Record<string, number>) ?? {};
        const votes: Record<string, string> = {};
        let n = 0;
        for (const id of active) {
          const count = Math.min(active.length, Math.max(0, Math.floor(Number(raw[id]) || 0)));
          for (let i = 0; i < count; i++) votes[`@${n++}`] = id;
        }
        const tally = { ...state.tally };
        for (const id of Object.values(votes)) tally[id] = (tally[id] ?? 0) + 1;
        return { ...state, votes, phase: 'result', tally };
      }
      case 'next': {
        // Nur aus der Auflösung heraus: zwei fast gleichzeitige Taps auf
        // „Weiter" würden sonst zwei Runden zählen, und die letzte Runde
        // fiele still aus. Die Inbox wendet Aktionen nacheinander an.
        if (state.phase !== 'result') return state;
        const deck = state.deck.length ? state.deck : spicyDeck(PROMPTS, 'most-likely', (p) => p.text, players.length);
        const round = state.round + 1;
        if (isOver(round, state.goal)) return { ...state, round, phase: 'over' };
        return {
          ...state,
          phase: 'vote',
          prompt: deck[0],
          deck: deck.slice(1),
          votes: {},
          round,
        };
      }
      case 'restart':
        return mostLikely.createState(players);
      default:
        return state;
    }
  },

  Component: MostLikelyGame,
};

function MostLikelyGame({ state, players, me, dispatch, quit, online }: GameRuntime<State>) {
  const send = (a: GameActionInput) => dispatch(a);
  const prompt = PROMPTS[state.prompt]?.text ?? '';
  // Gemerkt, damit die naechste Partie am selben Abend andere Fragen zieht.
  useEffect(() => {
    if (prompt) markTextsSeen([prompt]);
  }, [prompt]);

  if (state.phase === 'over') {
    const ranking = players.map((p) => ({
      player: p,
      value: state.tally[p.id] ?? 0,
      unit: 'Stimme',
    }));
    const most = Math.max(0, ...ranking.map((r) => r.value));
    const named = ranking.filter((r) => r.value === most).map((r) => r.player);
    return (
      <GameFrame
        title={mostLikely.name}
        accent={mostLikely.accent}
        subtitle="Ausgezählt"
        onQuit={quit}
      >
        <GameOver
          headline={
            most > 0
              ? `${state.round - 1} Fragen ausgezählt. Oben steht, wer am häufigsten gemeint war.`
              : `${state.round - 1} Fragen – und keine einzige Stimme. Auch eine Aussage.`
          }
          ranking={most > 0 ? ranking : undefined}
          rankingTitle="Wer am häufigsten gemeint war"
          rankHighIsBad
          finalCall={
            most > 0
              ? {
                  players: named,
                  baseSips: 4,
                  label: 'am häufigsten gemeint',
                  source: 'most-likely',
                }
              : undefined
          }
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  if (state.phase === 'vote') {
    const waiting = players.filter((p) => p.online !== false && !state.votes[p.id]).map((p) => p.name);
    return (
      <GameFrame
        title={mostLikely.name}
        accent={mostLikely.accent}
        subtitle={
          state.goal
            ? `Runde ${Math.min(state.round, state.goal)}/${state.goal}`
            : `Runde ${state.round}`
        }
        onQuit={quit}
      >
        <BigCard kicker="Zeigt auf">{prompt}</BigCard>
        {online ? (
          <>
            <VoteGrid
              players={players}
              myVote={state.votes[me.id]}
              onVote={(id) => {
                haptic('select');
                send({ type: 'vote', target: id });
              }}
            />
            {state.votes[me.id] && <WaitingFor names={waiting} what="Warten auf" />}
          </>
        ) : (
          <>
            <p className="t-sub t-center t-balance">
              Auf drei zeigen alle gleichzeitig auf eine Person. Trag danach ein, wie viele
              Finger jede Person abbekommen hat.
            </p>
            <FingerTally
              players={players}
              onSubmit={(counts) => {
                haptic('success');
                send({ type: 'countVotes', counts });
              }}
            />
          </>
        )}
      </GameFrame>
    );
  }

  const counts: Record<string, number> = {};
  for (const t of Object.values(state.votes)) counts[t] = (counts[t] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  const winners = players.filter((p) => (counts[p.id] ?? 0) === max && max > 0);

  // Originalregel: jeder trinkt pro Stimme, die auf ihn zeigt – nicht nur
  // die Meistgewählten. Gleiche Stimmenzahl teilt sich eine DrinkCallList,
  // damit der bestehende Baustein unverändert bleibt und trotzdem jede
  // Person ihre eigene Härte bekommt.
  const groups = new Map<number, GamePlayer[]>();
  for (const p of players) {
    const n = counts[p.id] ?? 0;
    if (n <= 0) continue;
    if (!groups.has(n)) groups.set(n, []);
    groups.get(n)?.push(p);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => b[0] - a[0]);

  return (
    <GameFrame
      title={mostLikely.name}
      accent={mostLikely.accent}
      subtitle="Aufgedeckt"
      onQuit={quit}
    >
      <BigCard kicker="Ergebnis">{prompt}</BigCard>
      <VoteResult players={players} counts={counts} highlight={winners[0]?.id ?? null} />
      {sortedGroups.length > 0 ? (
        <div className="stack-3">
          {sortedGroups.map(([n, group]) => (
            <DrinkCallList
              key={n}
              players={group}
              baseSips={Math.min(6, n)}
              source="most-likely"
              label="pro Stimme"
              resetKey={state.round}
            />
          ))}
        </div>
      ) : (
        <p className="t-sub t-center">Keine einzige Stimme diese Runde.</p>
      )}
      <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
        {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Nächste Frage'}
      </button>
    </GameFrame>
  );
}
