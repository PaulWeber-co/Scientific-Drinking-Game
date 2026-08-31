const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne I, O, 0, 1

/** Kurzer, gut vorlesbarer Lobby-Code. */
export function lobbyCode(length = 4): string {
  let out = '';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function uid(prefix = ''): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return prefix + Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
}

/** Stabile Geräte-ID, damit Reloads nicht als neuer Spieler zählen. */
export function deviceId(): string {
  const KEY = 'sdg.device-id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = uid('d_');
    localStorage.setItem(KEY, id);
  }
  return id;
}
