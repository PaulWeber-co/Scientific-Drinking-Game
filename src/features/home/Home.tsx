import { DriverCard } from '../bac/DriverCard';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ZONE_META, bacZone, soberAt } from '../../engine/bac';
import { formatBac, formatTime } from '../../lib/format';
import { GAMES } from '../../games/registry';
import { GameCard } from '../games/GameCard';
import { BacGauge } from '../bac/BacGauge';
import { useLiveBac } from '../bac/useLiveBac';
import { DrinkPicker } from '../drinks/DrinkPicker';
import { NavBar } from '../../components/ui';
import { Avatar } from '../../components/ui/Avatar';
import { Icon } from '../../components/icons';
import { useCurrentDrink, usePlayer } from '../../store/player';
import { useApp } from '../../store/app';
import { useParty } from '../party/PartyContext';

export function Home() {
  const nav = useNavigate();
  const profile = usePlayer((s) => s.profile);
  const log = usePlayer((s) => s.log);
  const drink = useCurrentDrink();
  const recent = useApp((s) => s.recentGames);
  const { estimate, now } = useLiveBac();
  const party = useParty();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!profile) return null;
  const zone = ZONE_META[bacZone(estimate?.bac ?? 0)];
  const sober = log.length ? soberAt(log, profile, now) : null;
  const suggested = (recent.length ? recent.map((id) => GAMES.find((g) => g.id === id)) : [])
    .filter(Boolean)
    .concat(GAMES.filter((g) => !recent.includes(g.id)))
    .slice(0, 4) as typeof GAMES;

  return (
    <div className="screen">
      <NavBar
        title={<span className="t-headline">Pegel</span>}
        right={
          <Link to="/profil" className="pressable" aria-label="Profil">
            <Avatar name={profile.name} color={profile.color} />
          </Link>
        }
      />

      <div className="stack-6">
        <section className="stack-3">
          <h1 className="t-large">Hi {profile.name}.</h1>
          <p className="t-sub">{zone.note}</p>
        </section>

        <section className="card card--pad-lg stack-3">
          <BacGauge
            bac={estimate?.bac ?? 0}
            pending={estimate?.pending ?? 0}
            target={profile.targetBac}
            label={
              estimate && estimate.pending > 0.01
                ? `+${formatBac(estimate.pending)} unterwegs`
                : `Ziel ${formatBac(profile.targetBac)}`
            }
          />
          <div className="row-between">
            <button className="chip pressable" onClick={() => setPickerOpen(true)}>
              <Icon name={drink.icon} size={15} />
              {drink.name} · wechseln
            </button>
            <Link to="/pegel" className="btn btn--plain">
              Details
            </Link>
          </div>
          {sober && (
            <div className="t-caption t-center">
              Voraussichtlich nüchtern gegen {formatTime(sober)} (konservativ gerechnet)
            </div>
          )}
        </section>

        <DriverCard />

        <section className="stack-3">
          {party.code ? (
            <button className="btn btn--brand btn--block btn--lg" onClick={() => nav('/lobby')}>
              Zurück in Lobby {party.code}
            </button>
          ) : (
            <button className="btn btn--brand btn--block btn--lg" onClick={() => nav('/lobby')}>
              Runde starten
            </button>
          )}
          <div className="grid-2">
            <button className="btn btn--glass" onClick={() => nav('/spiele')}>
              <Icon name="games" size={18} /> Alle Spiele
            </button>
            <button className="btn btn--glass" onClick={() => nav('/pegel')}>
              <Icon name="car" size={18} /> Fahr-Check
            </button>
          </div>
        </section>

        <section className="stack-3">
          <div className="row-between">
            <h2 className="t-title2">Schnell loslegen</h2>
            <Link to="/spiele" className="btn btn--plain">
              Alle
            </Link>
          </div>
          <div className="stack-3 stagger">
          {suggested.map((g) => (
            <GameCard key={g.id} game={g} onClick={() => nav(`/spiele/${g.id}`)} />
          ))}
          </div>
        </section>
      </div>

      <DrinkPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
