import { Directory, Filesystem } from '@capacitor/filesystem';
import { isNativeApp } from '../../lib/platform';

/**
 * Wo die Bilder liegen.
 *
 * Nativ im Verzeichnis `LibraryNoCloud`: das bleibt dauerhaft erhalten, wird
 * bei Speicherdruck NICHT vom System geräumt (anders als der Cache) und
 * landet nicht in iCloud – Fotos einer durchzechten Nacht haben in einem
 * fremden Backup nichts verloren. Im Browser legt dasselbe Plugin die Daten
 * in IndexedDB ab; der localStorage wäre bei etwa fünf Megabyte zu Ende.
 *
 * Die Bilder verlassen das Gerät nie. Geteilt wird ausschließlich, was
 * jemand selbst über das System-Menü verschickt.
 */

const DIR = Directory.LibraryNoCloud;
const FOLDER = 'film';

async function ensureFolder(): Promise<void> {
  await Filesystem.mkdir({ path: FOLDER, directory: DIR, recursive: true }).catch(() => {
    // Existiert bereits – das Plugin meldet das als Fehler.
  });
}

export async function savePhoto(name: string, blob: Blob): Promise<void> {
  await ensureFolder();
  const path = `${FOLDER}/${name}`;
  // Nativ nimmt das Plugin nur Base64 an, im Web direkt den Blob.
  const data = isNativeApp() ? await toBase64(blob) : blob;
  await Filesystem.writeFile({ path, directory: DIR, data });
}

/**
 * Adresse, unter der das Bild angezeigt werden kann.
 *
 * Nativ ist das eine echte Datei-URL – das Bild muss nicht durch die Bridge.
 * Im Web entsteht eine Objekt-Adresse, die der Aufrufer wieder freigeben
 * muss; `usePhotoUrl` erledigt das.
 */
export async function photoUrl(name: string): Promise<string | null> {
  const path = `${FOLDER}/${name}`;
  try {
    if (isNativeApp()) {
      const { uri } = await Filesystem.getUri({ path, directory: DIR });
      return window.Capacitor?.convertFileSrc?.(uri) ?? uri;
    }
    const { data } = await Filesystem.readFile({ path, directory: DIR });
    return data instanceof Blob ? URL.createObjectURL(data) : `data:image/jpeg;base64,${data}`;
  } catch {
    // Datei weg (manuell gelöscht, Speicher aufgeräumt) – kein Grund für
    // einen Absturz, das Album zeigt dann eine leere Hülle.
    return null;
  }
}

/** Nur im Web entstehen Objekt-Adressen, die wieder freigegeben werden müssen. */
export function releasePhotoUrl(url: string): void {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

export async function deletePhotos(names: readonly string[]): Promise<void> {
  for (const name of names) {
    await Filesystem.deleteFile({ path: `${FOLDER}/${name}`, directory: DIR }).catch(() => {});
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
