import { PORTRAIT, applyFilmLook } from '../camera/filmLook';

/**
 * Das eigene Profilbild.
 *
 * Es gibt genau einen Weg, wie ein Bild in dieses Profil kommt: jemand wählt
 * es selbst aus. Danach liegt es als kleines JPEG im Profil und damit im
 * `localStorage` dieses Geräts – wie Name, Gewicht und Trink-Log. Es geht
 * NICHT in die Lobby: dorthin gehen Spitzname, Avatarfarbe und Getränkesymbol,
 * und dabei bleibt es. Ein Gesicht ist eine andere Kategorie von Datum als ein
 * Spitzname, und ein Partyserver ist kein Ort dafür.
 *
 * Warum als Data-URL im Profil und nicht als Datei im Foto-Verzeichnis wie die
 * Album-Bilder: Der Avatar erscheint in Listen, Chips und Ranglisten hundertfach
 * und muss beim ersten Bild sofort da sein. Eine Datei müsste jedes Mal
 * asynchron geladen werden. Bei 256 × 256 Pixeln sind das meist 20–40 KB,
 * die Obergrenze liegt bei 120.000 Zeichen Data-URL (rund 90 KB JPEG) — für
 * EIN Bild pro Gerät ist das im Speicherbudget kein Thema, für 27 Abendbilder
 * wäre es das sehr wohl.
 */

/** Kantenlänge des gespeicherten Bildes. Reicht für 68 px auf 3x-Displays. */
export const AVATAR_PX = 256;

/** Größer nehmen wir kein Bild an – sonst platzt irgendwann der localStorage. */
export const MAX_BYTES = 120_000;

/**
 * Mittiger quadratischer Ausschnitt.
 *
 * Als reine Funktion, damit sie sich ohne Browser prüfen lässt: Bei einem
 * Hochformat wird oben etwas mehr stehen gelassen als unten – auf Fotos von
 * Menschen sitzt das Gesicht im oberen Drittel, ein exakt mittiger Schnitt
 * köpft es zuverlässig.
 */
export function squareCrop(
  width: number,
  height: number,
): { x: number; y: number; size: number } {
  const size = Math.min(width, height);
  if (height > width) {
    // Ein Drittel des Überhangs oben lassen statt der Hälfte.
    return { x: 0, y: Math.round((height - size) / 3), size };
  }
  return { x: Math.round((width - size) / 2), y: 0, size };
}

/**
 * Macht aus einer ausgewählten Datei ein fertiges Profilbild.
 *
 * Dieselbe Verfremdung wie im Album, nur zurückgenommen (`PORTRAIT`): Das
 * Profilbild soll neben den Abzügen des Abends stehen können, ohne wie ein
 * eingeklebtes Fremdbild zu wirken.
 *
 * Gibt `null` zurück, wenn die Datei kein lesbares Bild ist. Kein Werfen: an
 * der Aufrufstelle ist ein Hinweis die richtige Antwort, kein Absturz.
 */
export async function makeAvatarPhoto(file: File): Promise<string | null> {
  const bild = await ladeBild(file);
  if (!bild) return null;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const crop = squareCrop(bild.width, bild.height);
  ctx.drawImage(bild, crop.x, crop.y, crop.size, crop.size, 0, 0, AVATAR_PX, AVATAR_PX);

  try {
    const daten = ctx.getImageData(0, 0, AVATAR_PX, AVATAR_PX);
    applyFilmLook(daten.data, AVATAR_PX, AVATAR_PX, PORTRAIT);
    ctx.putImageData(daten, 0, 0);
  } catch {
    // getImageData kann an der Herkunft des Bildes scheitern. Dann eben ohne
    // Korn – ein Profilbild ohne Look ist besser als keins.
  }

  // Erst in guter Qualität, dann notfalls sparsamer. Zwei Anläufe reichen:
  // ein 256er-JPEG kommt bei 0,55 zuverlässig unter 120 KB.
  for (const q of [0.72, 0.55]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= MAX_BYTES) return url;
  }
  return null;
}

/**
 * Lädt die Datei als Bild.
 *
 * `createImageBitmap` dreht EXIF-gedrehte Handyfotos nicht von selbst gerade;
 * ein `<img>` tut das in allen aktuellen Browsern. Deshalb bewusst der
 * umständlichere Weg – sonst steht jedes zweite Hochkant-Selfie quer.
 */
function ladeBild(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
