import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AGE_GATE_TEXT, ageGate } from '../../engine/age';
import { bodyWaterLiters, widmarkFactor } from '../../engine/bac';
import { MAX_TARGET_BAC, MIN_TARGET_BAC } from '../../engine/constants';
import { DRINK_CATALOG, alcoholPerSip } from '../../engine/drinks';
import type { Profile, Sex, StomachState } from '../../engine/types';
import { EmojiPicker, Segmented, Stepper } from '../../components/ui';
import { haptic } from '../../lib/haptics';
import { formatBac } from '../../lib/format';
import { defaultProfile, usePlayer } from '../../store/player';
import { useApp } from '../../store/app';

const STEPS = ['start', 'name', 'alter', 'koerper', 'magen', 'drink', 'ziel'] as const;
type Step = (typeof STEPS)[number];

export function Onboarding() {
  const nav = useNavigate();
  const complete = usePlayer((s) => s.completeOnboarding);
  const acceptDisclaimer = useApp((s) => s.acceptDisclaimer);
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(defaultProfile);
  const [drinkId, setDrinkId] = useState('beer-pils');
  const [useHeight, setUseHeight] = useState(false);

  const gate = ageGate(p.age);
  const current: Step = STEPS[step];
  const patch = (v: Partial<Profile>) => setP((prev) => ({ ...prev, ...v }));

  const next = () => {
    haptic('select');
    if (current === 'alter' && gate === 'blocked') return;
    if (step === STEPS.length - 1) {
      acceptDisclaimer();
      complete({ ...p, alcoholFree: p.alcoholFree || gate !== 'full' }, drinkId);
      nav('/', { replace: true });
      return;
    }
    setStep((s) => s + 1);
  };
  const back = () => {
    haptic('tap');
    setStep((s) => Math.max(0, s - 1));
  };

  const canContinue =
    current !== 'name' ? current !== 'alter' || gate !== 'blocked' : p.name.trim().length >= 2;

  return (
    <div className="screen screen--full onboarding">
      <div className="onboarding__progress" aria-hidden>
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="onboarding__body">
        {current === 'start' && <StepStart />}
        {current === 'name' && (
          <StepShell title="Wie heißt du?" sub="Nur dein Spitzname wird an Mitspieler weitergegeben.">
            <input
              className="input input--center"
              placeholder="Spitzname"
              maxLength={16}
              autoFocus
              value={p.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <EmojiPicker value={p.emoji} onChange={(emoji) => patch({ emoji })} />
          </StepShell>
        )}
        {current === 'alter' && (
          <StepShell title="Wie alt bist du?" sub="Ehrlich. Die App rechnet damit.">
            <Stepper value={p.age} onChange={(age) => patch({ age })} min={12} max={99} unit="Jahre" />
            {gate !== 'full' && (
              <div className={`notice notice--${gate === 'blocked' ? 'red' : 'orange'}`}>
                {AGE_GATE_TEXT[gate]}
              </div>
            )}
          </StepShell>
        )}
        {current === 'koerper' && (
          <StepShell
            title="Körperdaten"
            sub="Bleiben auf diesem Gerät. Sie gehen nie an einen Server."
          >
            <Segmented<Sex>
              value={p.sex}
              onChange={(sex) => patch({ sex })}
              options={[
                { value: 'male', label: 'Männlich' },
                { value: 'female', label: 'Weiblich' },
                { value: 'diverse', label: 'Divers' },
              ]}
            />
            <div className="field">
              <span className="field__label">Gewicht</span>
              <Stepper value={p.weightKg} onChange={(weightKg) => patch({ weightKg })} min={35} max={200} unit="kg" />
            </div>
            {useHeight ? (
              <div className="field">
                <span className="field__label">Körpergröße (präzisere Rechnung)</span>
                <Stepper
                  value={p.heightCm ?? 175}
                  onChange={(heightCm) => patch({ heightCm })}
                  min={140}
                  max={215}
                  unit="cm"
                />
              </div>
            ) : (
              <button
                className="btn btn--plain"
                onClick={() => {
                  setUseHeight(true);
                  patch({ heightCm: 175 });
                }}
              >
                + Körpergröße angeben (genauer)
              </button>
            )}
            <ScienceNote profile={p} />
          </StepShell>
        )}
        {current === 'magen' && (
          <StepShell title="Schon was gegessen?" sub="Auf leerem Magen wirkt Alkohol deutlich schneller.">
            <Segmented<StomachState>
              value={p.stomach}
              onChange={(stomach) => patch({ stomach })}
              options={[
                { value: 'empty', label: 'Nichts' },
                { value: 'light', label: 'Snack' },
                { value: 'full', label: 'Richtig' },
              ]}
            />
            <p className="t-sub t-center t-balance">
              {p.stomach === 'empty'
                ? 'Voller Effekt nach ca. 20 Minuten. Die App dosiert entsprechend vorsichtig.'
                : p.stomach === 'light'
                  ? 'Ausgewogen – der Standardfall auf einer Party.'
                  : 'Alkohol braucht länger. Du bekommst am Anfang etwas mehr.'}
            </p>
          </StepShell>
        )}
        {current === 'drink' && (
          <StepShell title="Was trinkst du heute?" sub="Kannst du jederzeit wechseln.">
            <div className="drinkgrid">
              {DRINK_CATALOG.filter((d) => d.abvPercent > 0)
                .slice(0, 12)
                .map((d) => (
                  <button
                    key={d.id}
                    className={`drinktile pressable ${drinkId === d.id ? 'drinktile--on' : ''}`}
                    onClick={() => {
                      haptic('select');
                      setDrinkId(d.id);
                    }}
                  >
                    <span className="drinktile__emoji">{d.emoji}</span>
                    <span className="drinktile__name">{d.name}</span>
                    <span className="t-caption">{d.abvPercent} %</span>
                  </button>
                ))}
            </div>
          </StepShell>
        )}
        {current === 'ziel' && (
          <StepShell
            title="Dein Zielpegel"
            sub="0,4 Promille ist der Sweet Spot: locker, aber klar im Kopf."
          >
            <div className="targetpick">
              <div className="targetpick__value t-mono-num">{formatBac(p.targetBac)}</div>
              <input
                className="slider"
                type="range"
                min={MIN_TARGET_BAC * 100}
                max={MAX_TARGET_BAC * 100}
                step={5}
                value={p.targetBac * 100}
                onChange={(e) => patch({ targetBac: Number(e.target.value) / 100 })}
              />
              <div className="row-between t-caption">
                <span>vorsichtig</span>
                <span>locker</span>
                <span>Grenzbereich</span>
              </div>
            </div>
            <Preview profile={p} drinkId={drinkId} />
          </StepShell>
        )}
      </div>

      <div className="onboarding__actions">
        {step > 0 && (
          <button className="btn btn--plain" onClick={back}>
            Zurück
          </button>
        )}
        <button className="btn btn--brand btn--block btn--lg" disabled={!canContinue} onClick={next}>
          {step === STEPS.length - 1 ? "Los geht's" : step === 0 ? 'Verstanden' : 'Weiter'}
        </button>
      </div>
    </div>
  );
}

function StepShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="stack-6">
      <div className="stack-2">
        <h1 className="t-large t-balance">{title}</h1>
        {sub && <p className="t-sub t-balance">{sub}</p>}
      </div>
      <div className="stack">{children}</div>
    </div>
  );
}

function StepStart() {
  return (
    <div className="stack-6">
      <div className="hero-mark">🍸</div>
      <div className="stack-3">
        <h1 className="t-large t-balance">
          Trinkspiele,
          <br />
          die mitdenken.
        </h1>
        <p className="t-body t-dim t-balance">
          Jede Ansage wird auf deine Körperdaten und dein Getränk umgerechnet. Ziel ist nicht mehr
          Alkohol – sondern der richtige Pegel, den ganzen Abend.
        </p>
      </div>
      <div className="notice notice--neutral">
        <strong>Kurz vorab:</strong> Alle Berechnungen sind Schätzungen nach der Widmark-Formel und
        ersetzen keine medizinische Beratung. Medikamente, Müdigkeit und Tagesform verändern die
        Wirkung erheblich. Fahre nie unter Alkoholeinfluss. Im Zweifel: weniger trinken.
      </div>
    </div>
  );
}

function ScienceNote({ profile }: { profile: Profile }) {
  const { r, source } = widmarkFactor(profile);
  const tbw = bodyWaterLiters(profile);
  return (
    <div className="notice notice--neutral">
      <div className="t-upper">So rechnet die App</div>
      Verteilungsfaktor r = <strong>{r.toFixed(2)}</strong>{' '}
      {source === 'watson'
        ? `(aus ca. ${tbw?.toFixed(1)} l Körperwasser nach Watson)`
        : '(Standardwert – mit Körpergröße wird es genauer)'}
      .
    </div>
  );
}

function Preview({ profile, drinkId }: { profile: Profile; drinkId: string }) {
  const drink = useMemo(() => DRINK_CATALOG.find((d) => d.id === drinkId)!, [drinkId]);
  const { r } = widmarkFactor(profile);
  const grams = profile.targetBac * r * profile.weightKg;
  const sips = Math.max(1, Math.round(grams / alcoholPerSip(drink)));
  return (
    <div className="card">
      <div className="t-upper">Was das heißt</div>
      <p className="t-body" style={{ marginTop: 6 }}>
        Bis zu deinem Pegel sind es etwa <strong>{sips}</strong>{' '}
        {drink.sipIsUnit ? 'Shots' : 'Schlucke'} {drink.name} ({grams.toFixed(0)} g reiner Alkohol) –
        verteilt über den Abend, nicht auf einmal.
      </p>
    </div>
  );
}
