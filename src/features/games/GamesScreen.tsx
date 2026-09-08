import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GAMES, getGame } from '../../games/registry';
import { TAG_LABEL, type GameTag } from '../../games/types';
import { HeatIcons, Icon } from '../../components/icons';
import { GameCard } from './GameCard';
import { CustomCards } from './CustomCards';
import { SpicyToggle } from './SpicyToggle';
import { LENGTH_LABEL, baseFor, roundGoal } from '../../games/shared/rounds';
import { haptic } from '../../lib/haptics';
import { Segmented, Sheet } from '../../components/ui';
import { Avatar } from '../../components/ui/Avatar';
import { ZONE_META, bacZone } from '../../engine/bac';
import { formatBac } from '../../lib/format';
import { useLiveBac } from '../bac/useLiveBac';
import { usePlayer } from '../../store/player';
import { useParty } from '../party/PartyContext';
import { useApp, type GameLength } from '../../store/app';
import { Link } from 'react-router-dom';

/**
 * Abschnitte statt Filterzeile: Ein Filter kann angeschaltet bleiben, dann
 * fehlen scheinbar Spiele. Hier ist immer alles da, man scrollt nur.
 *
 * Zwei getrennte Reihenfolgen, weil sie Verschiedenes leisten:
 *
 * ZUORDNUNG geht von speziell nach allgemein. Die Tags überlappen stark –
 * `reden` und `handy-weg` treffen auf über die Hälfte der Spiele zu. Stünde
 * einer davon vorn, sammelte er fast alles ein und die kleinen Gruppen
 * blieben leer (Ring of Fire landete unter „Handy weg" statt bei „Karten").
 * `handy-weg` und `schnell` tauchen gar nicht auf: Sie beschreiben fast
 * jedes Spiel und trennen darum nichts.
 *
 * ANZEIGE stellt die bekannten Klassiker nach oben – wer die App öffnet,
 * sucht meist „Wahrheit oder Pflicht", nicht „Meme Battle".
 */
const ZUORDNUNG: GameTag[] = ['karten', 'bewegung', 'kreativ', 'geheim', 'reden'];
const ANZEIGE: GameTag[] = ['reden', 'geheim', 'karten', 'bewegung', 'kreativ'];
const GRUPPEN_TITEL: Partial<Record<GameTag, string>> = {
  reden: 'Klassiker zum Reden',
  geheim: 'Geheime Rollen',
  karten: 'Mit Karten',
  bewegung: 'Schnell und laut',
  kreativ: 'Kreativ',
};

export function GamesScreen() {
  const nav = useNavigate();
  const party = useParty();
  const profile = usePlayer((s) => s.profile);
  const recent = useApp((s) => s.recentGames);
  const { estimate } = useLiveBac();
  const count = party.players.length;

  const abschnitte = useMemo(() => {
    const zuletzt = recent.map((id) => GAMES.find((g) => g.id === id)).filter((g) => !!g);
    // Jedes Spiel erscheint genau einmal – sonst scrollt man an denselben
    // Kacheln mehrfach vorbei und verliert den Überblick, was es überhaupt
    // gibt. Einzige Ausnahme ist "Zuletzt gespielt".
    const vergeben = new Set<string>();
    const proTag = new Map<GameTag, typeof GAMES>();
    for (const tag of ZUORDNUNG) {
      const spiele = GAMES.filter((g) => g.tags.includes(tag) && !vergeben.has(g.id));
      spiele.forEach((g) => vergeben.add(g.id));
      if (spiele.length) proTag.set(tag, spiele);
    }
    const gruppen = ANZEIGE.filter((t) => proTag.has(t)).map((tag) => ({
      titel: GRUPPEN_TITEL[tag] ?? TAG_LABEL[tag],
      spiele: proTag.get(tag)!,
    }));
    const rest = GAMES.filter((g) => !vergeben.has(g.id));
    return [
      ...(zuletzt.length ? [{ titel: 'Zuletzt gespielt', spiele: zuletzt }] : []),
      ...gruppen,
      ...(rest.length ? [{ titel: 'Außerdem', spiele: rest }] : []),
    ];
  }, [recent]);

  const zone = ZONE_META[bacZone(estimate?.bac ?? 0)];

  return (
    <div className="screen screen--wand">
      <header className="wandkopf">
        <Link
          to="/pegel"
          className="pegelzeile pressable"
          aria-label={`Dein Pegel: ${zone.label}, ${formatBac(estimate?.bac ?? 0)} Promille`}
        >
          <span className="pegelzeile__punkt" style={{ background: zone.color }} />
          <span className="pegelzeile__text">
            {zone.label} · {formatBac(estimate?.bac ?? 0)} ‰
          </span>
          <Icon name="chevronRight" size={14} className="pegelzeile__pfeil" />
        </Link>
        <div className="row-between">
          <h1 className="t-display wandkopf__titel">Spiele</h1>
          {profile && (
            <Link to="/profil" className="pressable hit" aria-label="Profil">
              <Avatar name={profile.name} color={profile.color} />
            </Link>
          )}
        </div>
        <p className="wandkopf__sub">
          {GAMES.length} Stück · für {Math.min(...GAMES.map((g) => g.minPlayers))}–
          {Math.max(...GAMES.map((g) => g.maxPlayers))}
        </p>
      </header>

      {abschnitte.map((a) => (
        <section key={a.titel} className="wandteil">
          <h2 className="wandteil__titel">{a.titel}</h2>
          <div className="wandraster">
            {a.spiele.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                onClick={() => nav(`/spiele/${g.id}`)}
                // Wer allein stöbert, soll alles ungedimmt sehen. Erst wenn
                // eine Runde zusammensteht, zeigen wir zu große Spiele an.
                dimReason={
                  count > 1 && count < g.minPlayers ? `Braucht ${g.minPlayers}` : undefined
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function GameDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const party = useParty();
  const markGamePlayed = useApp((s) => s.markGamePlayed);
  const gameLength = useApp((s) => s.gameLength);
  const game = getGame(id);
  const [sheet, setSheet] = useState<null | 'laenge' | 'karten' | 'regeln'>(null);

  if (!game) {
    return (
      <div className="screen">
        <p className="t-sub">Dieses Spiel gibt es nicht.</p>
        <button className="btn btn--glass" onClick={() => nav('/')}>
          Zu den Spielen
        </button>
      </div>
    );
  }

  const count = party.players.length;
  const tooFew = count < game.minPlayers;
  const needsDevices = game.requiresOwnDevice && party.mode !== 'online';
  const rounds = roundGoal(baseFor(game.id), gameLength);

  const start = async () => {
    markGamePlayed(game.id);
    await party.startGame(game.id);
    nav('/spiel');
  };

  return (
    <div className="screen screen--detail" style={{ ['--accent' as string]: game.accent }}>
      <header className="detailkopf">
        <button className="btn btn--plain" onClick={() => nav(-1)}>
          <Icon name="chevronLeft" size={17} /> Spiele
        </button>
        <button
          className="detailkopf__hilfe pressable hit"
          aria-label="Spielregeln"
          onClick={() => setSheet('regeln')}
        >
          <Icon name="info" size={18} />
        </button>
      </header>

      {/* Derselbe Abzug wie die Kachel, nur gross: Der Titel steht als Tinte
          im Papier, nicht weiss auf dem Motiv. */}
      <div className="detailbild">
        <div className="detailbild__foto">
          {game.image ? (
            <img src={game.image} alt="" />
          ) : (
            <Icon className="detailbild__mark" name={game.icon} size={120} strokeWidth={1.2} />
          )}
        </div>
        <h1 className="t-display detailbild__titel">{game.name}</h1>
      </div>

      {/* Chips sind Anzeige UND Knopf: Was eingestellt ist, steht da – ohne
          Erklärsatz daneben. Wer nichts ändern will, tippt nur den Startknopf. */}
      <div className="detailchips">
        <button
          className={`chip pressable ${tooFew ? 'chip--warn' : ''}`}
          onClick={() => nav('/lobby')}
        >
          <Icon name="people" size={13} />
          {tooFew ? `${count} von ${game.minPlayers} Spielern` : `${count} Spieler`}
        </button>
        <button className="chip pressable" onClick={() => setSheet('laenge')}>
          {gameLength === 'endlos' ? 'Endlos' : `${rounds} Runden`}
        </button>
        {game.allowSpicy && <SpicyToggle game={game} />}
        {game.allowCustomCards && (
          <button className="chip pressable" onClick={() => setSheet('karten')}>
            <Icon name="plus" size={13} /> Eigene Karten
          </button>
        )}
      </div>

      {needsDevices && (
        <p className="detailhinweis">
          Bei {game.name} darf niemand die Eingaben der anderen sehen – dafür braucht ihr eine
          Online-Lobby.
        </p>
      )}
      {tooFew && !needsDevices && (
        <p className="detailhinweis">
          {game.name} braucht mindestens {game.minPlayers} Leute.
        </p>
      )}

      {/* Kein gesperrter Knopf: Er sagt stattdessen, was als Nächstes fehlt. */}
      <div className="detailstart">
        {tooFew || needsDevices ? (
          <button className="btn btn--brand btn--block btn--lg" onClick={() => nav('/lobby')}>
            {needsDevices ? 'Online-Lobby starten' : 'Leute hinzufügen'}
          </button>
        ) : (
          <button className="btn btn--brand btn--block btn--lg" onClick={start}>
            Los geht's
          </button>
        )}
      </div>

      <Sheet open={sheet === 'regeln'} onClose={() => setSheet(null)} title={game.name}>
        <div className="stack-3">
          <p className="t-sub">{game.tagline}</p>
          <ol className="howto">
            {game.howTo.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="chip chip--outline">
              <Icon name="people" size={13} />
              {game.minPlayers}–{game.maxPlayers}
            </span>
            <span className="chip chip--outline">
              <Icon name="clock" size={13} />
              {game.duration}
            </span>
            <span className="chip chip--outline">
              <HeatIcons level={game.intensity} size={13} />
            </span>
          </div>
        </div>
      </Sheet>

      <Sheet open={sheet === 'laenge'} onClose={() => setSheet(null)} title="Spiellänge">
        <LengthPicker gameId={game.id} />
      </Sheet>

      <Sheet open={sheet === 'karten'} onClose={() => setSheet(null)} title="Eigene Karten">
        <CustomCards game={game} />
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
    <div className="stack-3">
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
    </div>
  );
}
