import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { AGE_GATE_TEXT, ageGate } from '../../engine/age';
import { bodyWaterLiters, widmarkFactor } from '../../engine/bac';
import { MAX_TARGET_BAC, MIN_TARGET_BAC } from '../../engine/constants';
import type { Sex, StomachState } from '../../engine/types';
import { EmojiPicker, NavBar, Segmented, Stepper, Toggle } from '../../components/ui';
import { formatBac } from '../../lib/format';
import { DATABASE_URL } from '../../lib/firebase';
import { useCurrentDrink, usePlayer } from '../../store/player';
import { useApp } from '../../store/app';
import { DrinkPicker } from '../drinks/DrinkPicker';

export function ProfileScreen() {
  const nav = useNavigate();
  const profile = usePlayer((s) => s.profile);
  const patch = usePlayer((s) => s.patchProfile);
  const resetAll = usePlayer((s) => s.resetAll);
  const drink = useCurrentDrink();
  const app = useApp();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!profile) return null;
  const gate = ageGate(profile.age);
  const { r, source } = widmarkFactor(profile);
  const tbw = bodyWaterLiters(profile);

  return (
    <div className="screen">
      <NavBar title="Profil" left={<button className="btn btn--plain" onClick={() => nav(-1)}>Zurück</button>} />
      <div className="stack-6">
        <section className="stack-3" style={{ alignItems: 'center' }}>
          <div className="avatar avatar--lg">{profile.emoji}</div>
          <input
            className="input input--center"
            value={profile.name}
            maxLength={16}
            onChange={(e) => patch({ name: e.target.value })}
          />
          <EmojiPicker value={profile.emoji} onChange={(emoji) => patch({ emoji })} />
        </section>

        <section className="stack-3">
          <div className="list-header t-upper">Körperdaten</div>
          <Segmented<Sex>
            value={profile.sex}
            onChange={(sex) => patch({ sex })}
            options={[
              { value: 'male', label: 'Männlich' },
              { value: 'female', label: 'Weiblich' },
              { value: 'diverse', label: 'Divers' },
            ]}
          />
          <div className="field">
            <span className="field__label">Gewicht</span>
            <Stepper value={profile.weightKg} onChange={(weightKg) => patch({ weightKg })} min={35} max={200} unit="kg" />
          </div>
          <div className="field">
            <span className="field__label">Körpergröße (optional, präziser)</span>
            <Stepper
              value={profile.heightCm ?? 175}
              onChange={(heightCm) => patch({ heightCm })}
              min={140}
              max={215}
              unit="cm"
            />
          </div>
          <div className="field">
            <span className="field__label">Alter</span>
            <Stepper value={profile.age} onChange={(age) => patch({ age })} min={12} max={99} unit="Jahre" />
          </div>
          {gate !== 'full' && <div className="notice notice--orange">{AGE_GATE_TEXT[gate]}</div>}
          <div className="field">
            <span className="field__label">Magen</span>
            <Segmented<StomachState>
              value={profile.stomach}
              onChange={(stomach) => patch({ stomach })}
              options={[
                { value: 'empty', label: 'Leer' },
                { value: 'light', label: 'Snack' },
                { value: 'full', label: 'Satt' },
              ]}
            />
          </div>
          <div className="notice notice--neutral">
            Verteilungsfaktor r = <strong>{r.toFixed(2).replace('.', ',')}</strong>{' '}
            {source === 'watson' ? `· aus ${tbw?.toFixed(1).replace('.', ',')} l Körperwasser (Watson)` : '· Standardwert'}
          </div>
        </section>

        <section className="stack-3">
          <div className="list-header t-upper">Trinken</div>
          <div className="list">
            <button className="list__item" onClick={() => setPickerOpen(true)}>
              <span className="avatar avatar--sm">{drink.emoji}</span>
              <span className="grow">
                <span className="t-headline" style={{ display: 'block' }}>
                  {drink.name}
                </span>
                <span className="t-caption">{drink.abvPercent} Vol.-%</span>
              </span>
              <span className="list__chevron">›</span>
            </button>
            <div className="list__item">
              <span className="grow">
                <span className="t-headline" style={{ display: 'block' }}>
                  Alkoholfrei mitspielen
                </span>
                <span className="t-caption">Du bekommst Aufgaben statt Schlucken</span>
              </span>
              <Toggle
                checked={profile.alcoholFree}
                onChange={(alcoholFree) => patch({ alcoholFree })}
                label="Alkoholfrei"
              />
            </div>
          </div>
          <div className="targetpick">
            <div className="t-upper">Zielpegel</div>
            <div className="targetpick__value t-mono-num">{formatBac(profile.targetBac)}</div>
            <input
              className="slider"
              type="range"
              min={MIN_TARGET_BAC * 100}
              max={MAX_TARGET_BAC * 100}
              step={5}
              value={profile.targetBac * 100}
              onChange={(e) => patch({ targetBac: Number(e.target.value) / 100 })}
            />
          </div>
        </section>

        <section className="stack-3">
          <div className="list-header t-upper">App</div>
          <div className="list">
            <div className="list__item">
              <span className="grow t-headline">Vibration</span>
              <Toggle checked={app.haptics} onChange={() => app.toggleHaptics()} label="Vibration" />
            </div>
            <div className="list__item">
              <span className="grow t-headline">Wasser-Erinnerung</span>
              <Toggle checked={app.waterReminder} onChange={() => app.toggleWaterReminder()} label="Wasser-Erinnerung" />
            </div>
            <div className="list__item">
              <span className="grow t-headline">Darstellung</span>
              <div style={{ width: 150 }}>
                <Segmented
                  value={app.theme}
                  onChange={(t) => app.setTheme(t)}
                  options={[
                    { value: 'dark' as const, label: 'Dunkel' },
                    { value: 'light' as const, label: 'Hell' },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="stack-3">
          <div className="list-header t-upper">Daten & Recht</div>
          <div className="notice notice--neutral">
            <strong>Wo liegen deine Daten?</strong> Name, Alter, Gewicht, Getränk und dein Trink-Log
            liegen ausschließlich im Speicher dieses Browsers. Sie werden nie hochgeladen. In einer
            Online-Lobby werden nur Spitzname, Avatar und Getränke-Symbol geteilt – über eine
            Firebase Realtime Database ({new URL(DATABASE_URL).host}, Region Europa). Lobbys löschen
            sich nach 8 Stunden selbst.
          </div>
          <div className="notice notice--neutral">
            <strong>Disclaimer.</strong> Alle Werte sind Schätzungen nach der Widmark-Formel mit
            Resorptionsmodell. Individuelle Faktoren (Medikamente, Krankheit, Müdigkeit,
            Ernährung, Tagesform) verändern die Wirkung erheblich. Diese App ersetzt keine
            medizinische Beratung und ist kein Messgerät. Fahre niemals unter Alkoholeinfluss.
          </div>
          <button
            className="btn btn--danger btn--block"
            onClick={() => {
              if (confirm('Profil und alle lokalen Daten löschen?')) {
                resetAll();
                nav('/onboarding', { replace: true });
              }
            }}
          >
            Alles zurücksetzen
          </button>
        </section>
      </div>
      <DrinkPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
