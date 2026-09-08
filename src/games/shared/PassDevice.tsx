import { Avatar } from '../../components/ui/Avatar';
import { haptic } from '../../lib/haptics';
import type { GamePlayer } from '../types';

/**
 * Der Bildschirm zwischen zwei Spielern, wenn ein Handy herumgereicht wird.
 *
 * Er ist das Schutzschild: nach einem Geheimnis kommt nie direkt das nächste,
 * sondern immer erst diese neutrale Fläche. Der Knopf trägt den Namen der
 * Person und ist damit Bestätigung und Ansage in einem — genau so lösen es
 * die verbreiteten Vertreter des Genres.
 */
interface Props {
  /** Wer als Nächstes schauen soll. */
  player: GamePlayer;
  /** Der wievielte von wie vielen. Ohne den weiß niemand, wie lang es dauert. */
  step: number;
  total: number;
  onConfirm: () => void;
}

export function PassDevice({ player, step, total, onConfirm }: Props) {
  return (
    <div className="passdev">
      {/* Der unbelichtete Abzug: Solange niemand mitlesen darf, bleibt das
          Bild schwarz und der Stempel leer. Dieselbe Sprache wie im Spiel,
          nur ohne Inhalt – das macht die Sperre sichtbar statt bloß leer. */}
      <div className="abzug passdev__abzug">
        <div className="abzug__foto abzug__foto--leer">
          <span className="t-upper">Gib das Handy weiter an</span>
          <Avatar name={player.name} color={player.color} size="lg" />
          <span className="passdev__name">{player.name}</span>
          <span className="t-caption">
            {step} von {total}
          </span>
          <p className="t-sub t-center t-balance">Alle anderen: jetzt nicht mitlesen.</p>
        </div>
        <span className="abzug__stempel abzug__stempel--leer" aria-hidden>
          — — —
        </span>
      </div>
      <button
        className="btn btn--brand btn--block btn--lg"
        onClick={() => {
          haptic('select');
          onConfirm();
        }}
      >
        Ich bin {player.name}
      </button>
    </div>
  );
}
