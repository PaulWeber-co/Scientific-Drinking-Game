import { GroupLevel } from './GroupLevel';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MIN_AGE_ALCOHOL, MIN_AGE_APP } from '../../engine/constants';
import { DRINK_CATALOG, findDrink } from '../../engine/drinks';
import type { Profile, Sex } from '../../engine/types';
import { ColorPicker, NavBar, Segmented, Sheet, Stepper } from '../../components/ui';
import { AVATAR_COLORS, Avatar, type AvatarColor } from '../../components/ui/Avatar';
import { Icon } from '../../components/icons';
import { QrCode } from '../../components/ui/QrCode';
import { haptic } from '../../lib/haptics';
import { gamesForGroup } from '../../games/registry';
import { GameCard } from '../games/GameCard';
import { useParty } from '../party/PartyContext';
import { usePlayer } from '../../store/player';
import { useApp } from '../../store/app';

export function LobbyScreen() {
  const party = useParty();
  const nav = useNavigate();
  const [joinOpen, setJoinOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const lastCode = useApp((s) => s.lastLobbyCode);
  const markGamePlayed = useApp((s) => s.markGamePlayed);

  const online = party.mode === 'online' && !!party.code;
  const players = party.players;
  const suitable = gamesForGroup(players.length, online);

  const inviteUrl = `${location.origin}${location.pathname}#/lobby?code=${party.code}`;

  const shareLink = () => {
    const url = inviteUrl;
    const text = `Komm in unsere Runde! Lobby-Code: ${party.code}`;
    haptic('select');
    if (navigator.share) navigator.share({ title: 'Pegel', text, url }).catch(() => {});
    else navigator.clipboard?.writeText(`${text}\n${url}`);
  };

  return (
    <div className="screen">
      <NavBar
        title="Runde"
        right={
          online ? (
            <button className="btn btn--plain" style={{ color: 'var(--red)' }} onClick={party.leave}>
              Verlassen
            </button>
          ) : null
        }
      />

      <div className="stack-6">
        {online ? (
          <section className="card card--pad-lg stack-3">
            <div className="t-upper t-center">Lobby-Code</div>
            <div className="lobbycode" onClick={shareLink} role="button" tabIndex={0}>
              {party.code?.split('').map((c, i) => (
                <span key={i} className="lobbycode__char">
                  {c}
                </span>
              ))}
            </div>
            <div className="qrwrap">
              <QrCode value={inviteUrl} size={168} />
              <div className="t-caption t-center">Scannen statt tippen</div>
            </div>
            <div className={`connstate connstate--${party.connection}`}>
              <span className="connstate__dot" />
              {party.connection === 'online'
                ? 'Live verbunden · Code weitergeben'
                : party.connection === 'connecting'
                  ? 'Verbinde …'
                  : 'Offline – die App holt auf, sobald das Netz zurück ist'}
            </div>
            <button className="btn btn--glass btn--block" onClick={shareLink}>
              <Icon name="share" size={18} /> Einladung teilen
            </button>
          </section>
        ) : (
          <section className="stack-3">
            <h1 className="t-large t-balance">Wie spielt ihr?</h1>
            <button
              className="btn btn--brand btn--block btn--lg"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await party.createOnline();
                  haptic('success');
                } catch {
                  /* Fehler steht in party.error */
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? (
                'Lobby wird erstellt …'
              ) : (
                <>
                  <Icon name="phone" size={19} /> Jeder mit eigenem Handy
                </>
              )}
            </button>
            <div className="grid-2">
              <button className="btn btn--glass" onClick={() => setJoinOpen(true)}>
                <Icon name="qr" size={17} /> Code eingeben
              </button>
              <button className="btn btn--glass" onClick={() => setAddOpen(true)}>
                <Icon name="plus" size={17} /> Mitspieler
              </button>
            </div>
            <p className="t-caption t-center t-balance">
              Ohne Lobby läuft alles auf diesem einen Handy. Trag deine Mitspieler ein – dann
              rechnet die App auch für sie individuell.
            </p>
            {lastCode && (
              <button
                className="btn btn--plain btn--block"
                onClick={() => party.joinOnline(lastCode).catch(() => {})}
              >
                Zurück in Lobby {lastCode}
              </button>
            )}
          </section>
        )}

        {party.error && <div className="notice notice--red">{party.error}</div>}

        <GroupLevel players={players} />

        <section className="stack-3">
          <div className="row-between">
            <h2 className="t-title2">
              {players.length} {players.length === 1 ? 'Spieler' : 'Spieler'}
            </h2>
            {!online && (
              <button className="btn btn--plain" onClick={() => setAddOpen(true)}>
                + Hinzufügen
              </button>
            )}
          </div>
          <div className="list">
            {players.map((p) => (
              <div key={p.id} className="list__item">
                <Avatar name={p.name} color={p.color} size="sm" />
                <span className="grow">
                  <span className="t-headline" style={{ display: 'block' }}>
                    {p.name} {p.id === party.me.id && <span className="t-caption">(du)</span>}
                  </span>
                  <span className="t-caption row" style={{ gap: 5 }}>
                    {p.isHost && <>Host ·</>}
                    <Icon name={p.driver ? 'car' : (p.drinkIcon ?? 'water')} size={13} />
                    {p.driver && <span className="drivertag">fährt</span>}
                    {p.online === false && <>· offline</>}
                  </span>
                </span>
                {p.local && (
                  <button
                    className="btn btn--plain"
                    style={{ color: 'var(--red)' }}
                    onClick={() => party.removeLocalPlayer(p.id)}
                  >
                    Entfernen
                  </button>
                )}
              </div>
            ))}
          </div>
          {players.length < 3 && (
            <div className="notice notice--neutral">
              Die meisten Spiele brauchen mindestens 3 Personen. Für 4-16 Spieler ist die App
              gebaut.
            </div>
          )}
        </section>

        <section className="stack-3">
          <h2 className="t-title2">Passt zu euch</h2>
          {suitable.length ? (
            suitable.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                onClick={() => {
                  markGamePlayed(g.id);
                  party.startGame(g.id);
                  nav('/spiel');
                }}
              />
            ))
          ) : (
            <div className="notice notice--neutral">
              Für diese Gruppengröße ist noch nichts dabei. Trag mehr Spieler ein.
            </div>
          )}
        </section>
      </div>

      <JoinSheet
        open={joinOpen}
        code={code}
        setCode={setCode}
        onClose={() => setJoinOpen(false)}
        onJoin={async () => {
          try {
            await party.joinOnline(code);
            haptic('success');
            setJoinOpen(false);
          } catch {
            /* Fehler steht in party.error */
          }
        }}
      />
      <AddPlayerSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function JoinSheet({
  open,
  onClose,
  code,
  setCode,
  onJoin,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  setCode: (v: string) => void;
  onJoin: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Lobby beitreten">
      <div className="stack-3">
        <input
          className="input input--center"
          style={{ letterSpacing: '10px', fontSize: 30, textTransform: 'uppercase' }}
          placeholder="CODE"
          maxLength={6}
          inputMode="text"
          autoCapitalize="characters"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        />
        <button className="btn btn--brand btn--block btn--lg" disabled={code.length < 4} onClick={onJoin}>
          Beitreten
        </button>
        <p className="t-caption t-center">
          Den Code bekommst du von der Person, die die Runde gestartet hat.
        </p>
      </div>
    </Sheet>
  );
}

function AddPlayerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const party = useParty();
  const myProfile = usePlayer((s) => s.profile);
  const [name, setName] = useState('');
  // Jeder neue Gast bekommt automatisch eine noch freie Avatarfarbe.
  const taken = party.players.map((p) => p.color);
  const [color, setColor] = useState<AvatarColor>(
    () => AVATAR_COLORS.find((c) => !taken.includes(c)) ?? 'purple',
  );
  const [sex, setSex] = useState<Sex>('female');
  const [weight, setWeight] = useState(65);
  const [age, setAge] = useState(myProfile?.age ?? 25);
  const [drinkId, setDrinkId] = useState('beer-pils');

  const submit = () => {
    const profile: Profile = {
      ...(myProfile ?? {
        age: 25,
        stomach: 'light',
        targetBac: 0.4,
        alcoholFree: false,
        heightCm: undefined,
      }),
      name: name.trim() || 'Gast',
      color,
      sex,
      age,
      weightKg: weight,
      heightCm: undefined,
      alcoholFree: false,
      designatedDriver: false,
    } as Profile;
    party.addLocalPlayer({ name: profile.name, color, profile, drinkId });
    haptic('success');
    setName('');
    const used = [...party.players.map((p) => p.color), color];
    setColor(AVATAR_COLORS.find((c) => !used.includes(c)) ?? 'purple');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Mitspieler auf diesem Handy">
      <div className="stack">
        <p className="t-sub t-balance">
          Für Pass-&-Play: mit Gewicht und Getränk rechnet die App auch für diese Person die
          richtige Menge aus. Die Daten bleiben auf diesem Gerät und werden beim Schließen der App
          nicht gespeichert.
        </p>
        <input className="input" placeholder="Name" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="row" style={{ justifyContent: 'center' }}>
          <Avatar name={name || 'Gast'} color={color} size="lg" />
        </div>
        <ColorPicker value={color} onChange={setColor} />
        <Segmented<Sex>
          value={sex}
          onChange={setSex}
          options={[
            { value: 'male', label: 'Männlich' },
            { value: 'female', label: 'Weiblich' },
            { value: 'diverse', label: 'Divers' },
          ]}
        />
        <div className="field">
          <span className="field__label">Alter</span>
          <Stepper value={age} onChange={setAge} min={MIN_AGE_APP} max={99} unit="Jahre" />
        </div>
        {age < MIN_AGE_ALCOHOL && (
          <div className="notice notice--neutral">
            Unter {MIN_AGE_ALCOHOL}: {name.trim() || 'Der Gast'} bekommt Aufgaben statt Schlucke.
          </div>
        )}
        <div className="field">
          <span className="field__label">Gewicht</span>
          <Stepper value={weight} onChange={setWeight} min={35} max={200} unit="kg" />
        </div>
        <div className="field">
          <span className="field__label">Getränk: {findDrink(drinkId).name}</span>
          <div className="drinkgrid">
            {DRINK_CATALOG.filter((d) => d.abvPercent > 0).map((d) => (
              <button
                key={d.id}
                className={`drinktile pressable ${drinkId === d.id ? 'drinktile--on' : ''}`}
                onClick={() => setDrinkId(d.id)}
              >
                <Icon name={d.icon} size={24} className="drinktile__icon" />
                <span className="drinktile__name">{d.name}</span>
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn--brand btn--block btn--lg" onClick={submit}>
          Hinzufügen
        </button>
      </div>
    </Sheet>
  );
}
