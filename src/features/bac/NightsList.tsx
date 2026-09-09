import { useEffect, useState } from 'react';
import { formatBac, formatNightDate, formatTime, plural } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { Icon } from '../../components/icons';
import { Sheet } from '../../components/ui';
import { Avatar } from '../../components/ui/Avatar';
import { useNights, type Night } from '../../store/nights';
import { useFilm } from '../../store/film';
import { summarizeNight } from './nightSummary';
import { Stat } from './Stat';

/**
 * Die vergangenen Abende, neueste zuerst.
 *
 * Wohnt vorerst im Pegel-Tab, weil der Rückblick hier schon sitzt. Der
 * eigene Platz kommt mit dem Album.
 */
export function NightsList() {
  const nights = useNights((s) => s.nights);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = nights.find((n) => n.id === openId) ?? null;

  if (!nights.length) return null;

  return (
    <section className="stack-3">
      <h2 className="t-title2">Deine Abende</h2>
      <div className="list">
        {nights.map((n) => (
          <button
            key={n.id}
            className="list__item pressable"
            onClick={() => {
              haptic('tap');
              setOpenId(n.id);
            }}
          >
            <span className="grow">
              <span className="t-headline" style={{ display: 'block' }}>
                {formatNightDate(n.startedAt)}
                {n.place ? ` · ${n.place}` : ''}
              </span>
              <span className="t-caption">{participantLine(n)}</span>
            </span>
            <Icon name="chevronRight" size={17} />
          </button>
        ))}
      </div>

      <NightDetail night={open} onClose={() => setOpenId(null)} />
    </section>
  );
}

/** „Mit Lisa, Paul und 2 weiteren" – oder der Hinweis, dass es allein war. */
function participantLine(n: Night): string {
  const names = n.participants.map((p) => p.name).filter(Boolean);
  if (!names.length) return 'Allein unterwegs';
  if (names.length <= 3) return `Mit ${names.join(', ')}`;
  return `Mit ${names.slice(0, 2).join(', ')} und ${names.length - 2} weiteren`;
}

function NightDetail({ night, onClose }: { night: Night | null; onClose: () => void }) {
  const setPlace = useNights((s) => s.setPlace);
  const remove = useNights((s) => s.remove);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const summary = night ? summarizeNight(night) : null;

  // Sonst steht die Rückfrage noch offen, wenn man den nächsten Abend öffnet.
  useEffect(() => {
    setConfirmOpen(false);
  }, [night?.id]);

  return (
    <Sheet open={!!night} onClose={onClose} title={night ? formatNightDate(night.startedAt) : ''}>
      {night && (
        <div className="stack">
          <label className="stack-2">
            <span className="t-caption">Wo war das?</span>
            <input
              className="input"
              placeholder="Bei Paul im Garten"
              maxLength={40}
              defaultValue={night.place ?? ''}
              onBlur={(e) => setPlace(night.id, e.target.value)}
            />
          </label>

          <section className="stack-2">
            <span className="t-caption">
              {plural(night.participants.length, 'Dabei war', 'Dabei waren')}
            </span>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {night.participants.map((p) => (
                <span key={p.id} className="chip">
                  <Avatar name={p.name} color={p.color} size="sm" />
                  <span className="chip__text">{p.name}</span>
                </span>
              ))}
              {!night.participants.length && <span className="t-sub">Niemand eingetragen</span>}
            </div>
          </section>

          {summary ? (
            <div className="statgrid">
              <Stat value={formatBac(summary.peakBac)} label="Höchster Pegel" />
              <Stat
                value={summary.standardDrinks.toFixed(1).replace('.', ',')}
                label="Standardgläser"
              />
              <Stat value={String(summary.calls)} label="Trinkansagen" />
              <Stat value={String(summary.water)} label="Gläser Wasser" />
              <Stat value={formatTime(night.startedAt)} label="Losgegangen" />
              <Stat value={formatTime(night.endedAt)} label="Schluss" />
            </div>
          ) : (
            <div className="notice notice--neutral">
              An diesem Abend wurde nichts eingetragen – gespielt aber schon.
            </div>
          )}

          {summary?.topGame && <p className="t-sub">Meistgespielt: {summary.topGame}</p>}

          {/* Zweistufig im selben Blatt statt in einem zweiten darüber:
              zwei gestapelte Sheets geben beim Schließen des oberen den
              Hintergrund-Scroll wieder frei, obwohl das untere noch steht. */}
          {confirmOpen ? (
            <div className="stack-2">
              <p className="t-sub">
                Der Abend ist danach weg, mit allen Bildern. Das lässt sich nicht rückgängig
                machen.
              </p>
              <div className="grid-2">
                <button
                  className="btn btn--gray"
                  onClick={() => {
                    haptic('tap');
                    setConfirmOpen(false);
                  }}
                >
                  Behalten
                </button>
                <button
                  className="btn btn--danger"
                  onClick={() => {
                    haptic('warn');
                    // Erst die Bilder vormerken, dann den Abend: danach wäre
                    // die Zuordnung weg und der Aufräumer fände sie nie.
                    useFilm.getState().removeNight(night.id);
                    remove(night.id);
                    setConfirmOpen(false);
                    onClose();
                  }}
                >
                  Löschen
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn--gray btn--block"
              onClick={() => {
                haptic('tap');
                setConfirmOpen(true);
              }}
            >
              <Icon name="trash" size={17} /> Abend löschen
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
