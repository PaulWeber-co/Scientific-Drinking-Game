import { Directory, Filesystem } from '@capacitor/filesystem';
import { isNativeApp } from './platform';

/**
 * Gibt eine Datei an das Teilen-Menü des Systems – oder, ohne eines
 * (Desktop-Browser), als Download.
 *
 * Nativ über das Share-Plugin statt `navigator.share`: Im WebView verlangt
 * `navigator.share` einen frischen Fingertipp, und bis Rahmen oder Karte
 * gerechnet sind, ist der verfallen. Der Fehler wurde verschluckt, auf dem
 * Gerät tat „Teilen" einfach nichts. Die Datei geht dafür einmal in den
 * Cache – das System räumt ihn selbst.
 */
export async function shareFile(blob: Blob, name: string, title?: string): Promise<void> {
  if (isNativeApp()) {
    // Erst hier geladen: der Web-Build braucht das Plugin nicht.
    const { Share } = await import('@capacitor/share');
    const { uri } = await Filesystem.writeFile({
      path: name,
      directory: Directory.Cache,
      data: await toBase64(blob),
    });
    // Abbrechen im Menü meldet das Plugin als Fehler – das ist keiner.
    await Share.share({ files: [uri], title }).catch(() => {});
    return;
  }
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // Sofortiges Freigeben bricht den Download in manchen Browsern ab.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Text mit Link ins Teilen-Menü. Ergebnis: ob ein Menü aufging.
 *
 * Die Android-WebView kennt `navigator.share` gar nicht – ohne das Plugin
 * landete eine Einladung dort nur in der Zwischenablage.
 */
export async function shareLink(opts: { title: string; text: string; url: string }): Promise<boolean> {
  if (isNativeApp()) {
    const { Share } = await import('@capacitor/share');
    // Abbrechen im Menü meldet das Plugin als Fehler – das Menü war trotzdem da.
    await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: opts.title }).catch(() => {});
    return true;
  }
  if (navigator.share) {
    await navigator.share(opts).catch(() => {});
    return true;
  }
  return false;
}

/** Nativ nimmt das Filesystem-Plugin nur Base64 an. */
export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
