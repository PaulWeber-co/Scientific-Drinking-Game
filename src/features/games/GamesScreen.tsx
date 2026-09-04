import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GAMES, getGame } from '../../games/registry';
import { TAG_ICON, TAG_LABEL, type GameTag } from '../../games/types';
import { HeatIcons, Icon } from '../../components/icons';
import { GameCard } from './GameCard';
import { CustomCards } from './CustomCards';
import { SpicyToggle } from './SpicyToggle';
import { LENGTH_LABEL, baseFor, roundGoal } from '../../games/shared/rounds';
import { haptic } from '../../lib/haptics';
import { NavBar, Segmented, Sheet } from '../../components/ui';
import { useParty } from '../party/PartyContext';
import { useApp, type GameLength } from '../../store/app';

const FILTERS: (GameTag | 'alle')[] = ['alle', 'handy-weg', 'karten', 'kreativ', 'schnell', 'team', 'geheim'];

export function GamesScreen() {
  const nav = useNavigate();
  const party = useParty();
  const [filter, setFilter] = useState<GameTag | 'alle'>('alle');
  const count = party.players.length;

  const games = useMemo(
    () => (filter === 'alle' ? GAMES : GAMES.filter((g) => g.tags.includes(filter))),
    [filter],
  );

  return (
    <div className="screen">
      <NavBar title="Spiele" />
      <div className="stack">
        <p className="t-sub">
          {GAMES.length} Spiele. Jede Trinkansage wird pro Person umgerechnet – ihr spielt dasselbe
          Spiel, aber niemand trinkt zu viel.
        </p>
        <div className="scroll-x">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`chip pressable ${filter === f ? '' : 'chip--outline'}`}
              style={filter === f ? { ['--tint' as string]: 'var(--brand)' } : undefined}
              onClick={() => setFilter(f)}
            >
              {f === 'alle' ? 'Alle' : (
                <>
                  <Icon name={TAG_ICON[f]} size={14} />
                  {TAG_LABEL[f]}
                </>
              )}
            </button>
          ))}
        </div>
        <div className="stack-3 stagger">
          {games.map((g) => (
            <GameCard
              key={g.id}
              game={g}
              onClick={() => nav(`/spiele/${g.id}`)}
              disabledReason={
                // Wer allein stöbert, soll alle Spiele sehen. Erst wenn eine Runde
                // wirklich zusammengestellt ist, blenden wir zu große Spiele aus.
                count > 1 && count < g.minPlayers
                  ? `Braucht mindestens ${g.minPlayers} Spieler – ihr seid ${count}`
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function GameDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const party = useParty();
  const markGamePlayed = useApp((s) => s.markGamePlayed);
  const game = getGame(id);
  const [warn, setWarn] = useState(false);

  if (!game) {
    return (
      <div className="screen">
        <NavBar title="Unbekannt" left={<button className="btn btn--plain" onClick={() => nav(-1)}>Zurück</button>} />
        <p className="t-sub">Dieses Spiel gibt es nicht.</p>
      </div>
    );
  }

  const count = party.players.length;
  const tooFew = count < game.minPlayers;
  const needsDevices = game.requiresOwnDevice && party.mode !== 'online';

  const start = async () => {
    if (tooFew || needsDevices) {
      setWarn(true);
      return;
    }
    markGamePlayed(game.id);
    await party.startGame(game.id);
    nav('/spiel');
  };

  return (
    <div className="screen" style={{ ['--accent' as string]: game.accent }}>
      <NavBar
        title={game.name}
        left={
          <button className="btn btn--plain" onClick={() => nav(-1)}>
            Zurück
          </button>
        }
      />
      <div className="stack-6">
        <div className="gamehero">
          <div className="gamehero__icon">
            <Icon name={game.icon} size={38} strokeWidth={1.5} />
          </div>
          <h1 className="t-title t-balance">{game.name}</h1>
          <p className="t-sub t-balance">{game.tagline}</p>
          <div className="row wrap" style={{ justifyContent: 'center', gap: 6 }}>
            <span className="chip chip--outline">
              <Icon name="people" size={13} />
              {game.minPlayers}–{game.maxPlayers} Spieler
            </span>
            <span className="chip chip--outline">
              <Icon name="clock" size={13} />
              {game.duration}
            </span>
            <span className="chip chip--outline">
              <HeatIcons level={game.intensity} size={13} />
            </span>
            {game.tags.map((t) => (
              <span key={t} className="chip chip--outline">
                <Icon name={TAG_ICON[t]} size={13} />
                {TAG_LABEL[t]}
              </span>
            ))}
          </div>
        </div>

        <section className="card stack-3">
          <div className="t-upper">So läuft es</div>
          <ol className="howto">
            {game.howTo.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        </section>

        <LengthPicker gameId={game.id} />

        <SpicyToggle game={game} />

        <CustomCards game={game} />

        {game.requiresOwnDevice && (
          <div className="notice notice--orange">
            Braucht eigene Handys – startet dafür eine Online-Lobby.
          </div>
        )}

        <div className="stack-3">
          <div className="card row-between">
            <div>
              <div className="t-headline">
                {count} {count === 1 ? 'Spieler' : 'Spieler'}
              </div>
              <div className="t-caption">
                {party.mode === 'online' ? `Lobby ${party.code}` : 'Ein Gerät (Pass & Play)'}
              </div>
            </div>
            <button className="btn btn--sm btn--gray" onClick={() => nav('/lobby')}>
              Ändern
            </button>
          </div>
          <button className="btn btn--brand btn--block btn--lg" onClick={start}>
            Spiel starten
          </button>
        </div>
      </div>

      <Sheet open={warn} onClose={() => setWarn(false)} title="Noch nicht startklar">
        <div className="stack-3">
          {tooFew && (
            <div className="notice notice--orange">
              {game.name} braucht mindestens {game.minPlayers} Spieler. Aktuell seid ihr {count}.
              Trag die Runde in der Lobby ein.
            </div>
          )}
          {needsDevices && (
            <div className="notice notice--orange">
              Bei {game.name} darf niemand die Eingaben der anderen sehen. Startet eine Online-Lobby,
              dann spielt jeder auf seinem eigenen Handy.
            </div>
          )}
          <button
            className="btn btn--brand btn--block"
            onClick={() => {
              setWarn(false);
              nav('/lobby');
            }}
          >
            Zur Lobby
          </button>
        </div>
      </Sheet>
    </div>
  );
}

/**
 * Wie lang die Partie laufen soll. Bewusst eine Einstellung für alle Spiele:
 * Wer einen kurzen Abend hat, will nicht in jedem Spiel neu entscheiden.
 * Jedes Spiel rechnet die Stufe in seine eigene Rundenzahl um.
 */
function LengthPicker({ gameId }: { gameId: string }) {
  const value = useApp((s) => s.gameLength);
  const setValue = useApp((s) => s.setGameLength);
  const basis = baseFor(gameId);
  const rounds = roundGoal(basis, value);
  return (
    <section className="card stack-3">
      <div className="row-between">
        <span className="t-headline">Spiellänge</span>
        <span className="t-caption">{LENGTH_LABEL[value]}</span>
      </div>
      <Segmented<GameLength>
        value={value}
        onChange={(l) => {
          haptic('select');
          setValue(l);
        }}
        options={[
          { value: 'kurz', label: 'Kurz' },
          { value: 'mittel', label: 'Mittel' },
          { value: 'lang', label: 'Lang' },
          // Ein Unendlich-Zeichen allein liest sich weder betrunken noch mit
          // Screenreader – die anderen drei Optionen sind auch Wörter.
          { value: 'endlos', label: 'Endlos' },
        ]}
      />
      <span className="t-caption">
        {value === 'endlos'
          ? basis === 0
            ? 'Auch der vierte König beendet dieses Spiel dann nicht mehr. Läuft, bis ihr selbst Schluss macht.'
            : 'Läuft, bis ihr selbst Schluss macht. Gilt für alle Spiele.'
          : basis === 0
            ? 'Dieses Spiel endet, wenn der vierte König gezogen ist. Die Einstellung gilt für die anderen Spiele.'
            : `Hier sind das ${rounds} Runden, danach kommt der Abschluss. Die Einstellung gilt für alle Spiele.`}
      </span>
    </section>
  );
}
