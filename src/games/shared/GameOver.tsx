import { Suspense, lazy, useState, type ReactNode } from 'react';
import { Icon } from '../../components/icons';
import { Avatar } from '../../components/ui/Avatar';
import { haptic } from '../../lib/haptics';
import { DrinkCall, DrinkCallList } from './DrinkCall';
import { BigCard } from './pieces';
import type { GamePlayer } from '../types';

/**
 * Bewusst nachgeladen statt statisch importiert: der Rückblick zieht über
 * `nightSummary` die Spiele-Registry mit, und die lädt ihrerseits diesen
 * Chunk. Als statischer Import entsteht daraus ein Zyklus, in dem der
 * Party-Kontext noch nicht ausgewertet ist – jedes Kartenspiel stirbt dann
 * beim Start mit „useParty muss innerhalb von PartyProvider benutzt werden".
 */
const NightReview = lazy(() =>
  import('../../features/bac/NightReview').then((m) => ({ default: m.NightReview })),
);

export interface RankRow {
  player: GamePlayer;
  /** Zahl für die Zeile, z. B. Stimmen oder verlorene Runden. */
  value: number;
  /** Einheit im Singular, etwa „Stimme" oder „Sieg". */
  unit?: string;
  /** Plural, wenn er nicht auf „n" endet: „Siege", nicht „Siegn". */
  unitPlural?: string;
}

interface Props {
  /** Eine Zeile darüber, was gerade zu Ende ging. */
  headline: ReactNode;
  /** Liste, wenn das Spiel etwas zählt. Höchster Wert zuerst. */
  ranking?: RankRow[];
  /** Überschrift über der Liste, sagt was dort steht. */
  rankingTitle?: string;
  /**
   * true = oben steht der schlechteste Wert (meiste Niederlagen, meiste
   * Busfahrten). Dann entfällt die Platzziffer: eine „1" im Kreis liest sich
   * als Sieg, und betrunken liest niemand erst die Überschrift.
   */
  rankHighIsBad?: boolean;
  /** Wer am Schluss trinkt, falls das Spiel das vorsieht. */
  finalCall?: { players: GamePlayer[]; baseSips: number; label?: string; source: string };
  /** Noch eine Partie mit denselben Leuten. */
  onAgain: () => void;
  onQuit: () => void;
}

/**
 * Abschluss einer Partie. Bewusst ohne Sieger aus Trinkmengen: wer am meisten
 * getrunken hat, ist kein Ergebnis, sondern eine Warnung. Punkte zeigt der
 * Bildschirm nur, wenn das Spiel welche führt – sonst endet er schlicht.
 */
export function GameOver({
  headline,
  ranking,
  rankingTitle,
  rankHighIsBad,
  finalCall,
  onAgain,
  onQuit,
}: Props) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [alle, setAlle] = useState(false);
  const sorted = ranking?.length ? [...ranking].sort((a, b) => b.value - a.value) : null;
  // Bei sechzehn Leuten stünden sonst sechzehn Zeilen über den Knöpfen.
  const LIMIT = 6;
  const ranked = sorted && !alle ? sorted.slice(0, LIMIT) : sorted;

  return (
    <div className="stack-3">
      <BigCard kicker="Vorbei">{headline}</BigCard>

      {ranked && (
        <div className="stack-2">
          {rankingTitle && <div className="t-upper t-center">{rankingTitle}</div>}
          {ranked.map((r, i) => (
            <div key={r.player.id} className="result-row">
              {!rankHighIsBad && <div className="result-row__rank">{i + 1}</div>}
              <Avatar name={r.player.name} color={r.player.color} size="sm" />
              <div className="grow">
                <div className="t-headline">{r.player.name}</div>
              </div>
              <div className="t-mono-num">
                {r.value}
                {r.unit && (
                  <span className="t-caption">
                    {' '}
                    {r.value === 1 ? r.unit : (r.unitPlural ?? `${r.unit}n`)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {sorted && !alle && sorted.length > LIMIT && (
            <button className="btn btn--plain btn--block" onClick={() => setAlle(true)}>
              Alle {sorted.length} anzeigen
            </button>
          )}
        </div>
      )}

      {finalCall &&
        (finalCall.players.length === 1 ? (
          <DrinkCall
            player={finalCall.players[0]}
            baseSips={finalCall.baseSips}
            label={finalCall.label}
            source={finalCall.source}
            resetKey="final"
          />
        ) : (
          finalCall.players.length > 1 && (
            <DrinkCallList
              players={finalCall.players}
              baseSips={finalCall.baseSips}
              label={finalCall.label}
              source={finalCall.source}
              resetKey="final"
            />
          )
        ))}

      <button
        className="btn btn--brand btn--block btn--lg"
        onClick={() => {
          haptic('success');
          onAgain();
        }}
      >
        Noch eine Runde
      </button>
      <button className="btn btn--glass btn--block" onClick={() => setReviewOpen(true)}>
        <Icon name="chart" size={18} /> Dein Abend in Zahlen
      </button>
      <button className="btn btn--plain btn--block" onClick={onQuit}>
        Zurück zur Lobby
      </button>

      {reviewOpen && (
        <Suspense fallback={null}>
          <NightReview open onClose={() => setReviewOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
