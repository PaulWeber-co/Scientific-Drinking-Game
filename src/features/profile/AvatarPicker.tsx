import { useRef, useState } from 'react';
import { Icon } from '../../components/icons';
import { ColorPicker } from '../../components/ui';
import { avatarStyle, initials, type AvatarColor } from '../../components/ui/Avatar';
import { haptic } from '../../lib/haptics';
import { formatStamp } from '../../lib/format';
import { makeAvatarPhoto } from './portrait';

/**
 * Profilbild und Avatarfarbe an einer Stelle.
 *
 * Gezeigt wird kein rundes Vorschaubildchen, sondern ein Abzug – dasselbe
 * Papier, mit dem die App überall sonst arbeitet (Spielkarte, Album,
 * Übergabe-Bildschirm). Das ist nicht Deko: Wer hier ein Bild einsetzt,
 * soll auf einen Blick sehen, dass es dieselbe Optik bekommt wie die Bilder
 * des Abends – Korn, warmer Stich, Blitzfleck. Ein sauberes Handyfoto in
 * einem runden Rahmen hätte damit nichts zu tun.
 *
 * Ohne Bild steht auf dem Abzug das Monogramm in der gewählten Farbe. Der
 * Rahmen bleibt derselbe, es wechselt nur, was belichtet ist.
 */
export function AvatarPicker({
  name,
  color,
  photo,
  onColor,
  onPhoto,
}: {
  name: string;
  color: AvatarColor;
  photo?: string;
  onColor: (c: AvatarColor) => void;
  onPhoto: (dataUrl: string | undefined) => void;
}) {
  const datei = useRef<HTMLInputElement | null>(null);
  const [lädt, setLädt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const wählen = async (file: File | undefined) => {
    if (!file) return;
    setLädt(true);
    setFehler(null);
    try {
      const url = await makeAvatarPhoto(file);
      if (!url) {
        setFehler('Das Bild ließ sich nicht lesen. Versuch ein anderes.');
        haptic('error');
        return;
      }
      onPhoto(url);
      haptic('success');
    } finally {
      setLädt(false);
      // Zurücksetzen, sonst löst dieselbe Datei beim zweiten Mal nichts aus.
      if (datei.current) datei.current.value = '';
    }
  };

  return (
    <div className="stack-3 avatarpick">
      <figure className={`abzug portrait ${lädt ? 'portrait--laedt' : ''}`}>
        <div className="abzug__foto portrait__foto" style={avatarStyle(color)}>
          {photo ? (
            <img className="portrait__img" src={photo} alt="Dein Profilbild" />
          ) : (
            <span className="portrait__mono">
              {initials(name) || <Icon name="person" size={44} strokeWidth={1.3} />}
            </span>
          )}
        </div>
        <figcaption className="abzug__stempel">{formatStamp(Date.now())}</figcaption>
      </figure>

      <input
        ref={datei}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void wählen(e.target.files?.[0])}
      />

      <div className="row avatarpick__aktionen">
        <button
          className="btn btn--glass"
          disabled={lädt}
          onClick={() => {
            haptic('tap');
            datei.current?.click();
          }}
        >
          <Icon name="camera" size={17} /> {photo ? 'Anderes Bild' : 'Bild wählen'}
        </button>
        {photo && (
          <button
            className="btn btn--plain"
            onClick={() => {
              haptic('tap');
              onPhoto(undefined);
            }}
          >
            Entfernen
          </button>
        )}
      </div>

      {fehler && <p className="t-caption t-center">{fehler}</p>}
      <p className="t-caption t-center t-balance">
        Bleibt auf diesem Gerät. In die Runde gehen nur Spitzname und Farbe.
      </p>

      <ColorPicker value={color} onChange={onColor} />
    </div>
  );
}
