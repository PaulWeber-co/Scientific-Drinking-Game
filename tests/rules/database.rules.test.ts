// @vitest-environment node
/**
 * Security Rules der Realtime Database gegen den echten Emulator.
 *
 * Läuft NICHT in `npm test`, sondern über `npm run test:rules` – das Skript
 * lädt den offiziellen Database-Emulator (Prüfsumme fest hinterlegt), startet
 * ihn lokal und führt diese Datei aus. Kein Produktivprojekt, kein Netz außer
 * 127.0.0.1: der Namespace beginnt mit `demo-`.
 *
 * Jeder Angriff aus dem Security-Audit steht hier als eigener Fall: wer nur
 * den Lobby-Code kennt, darf NICHT Host werden, fremde Spieler ändern oder
 * löschen, den Spielstand überschreiben, im Namen anderer Aktionen schicken
 * oder die Lobby löschen. Die legitimen Wege der App müssen weiter gehen.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  goOffline,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  set,
  update,
  type Database,
} from 'firebase/database';

const EMU = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000';
const [EMU_HOST, EMU_PORT] = [EMU.split(':')[0], Number(EMU.split(':')[1])];
const NS = 'demo-pegel-rules';
const RULES = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');

const CODE = 'ABC234';
const HOST = 'uid-host-0000000000000000000';
const GUEST = 'uid-guest-000000000000000000';
const EVIL = 'uid-evil-0000000000000000000';
const H = 3_600_000;

// ---------- Hilfen ----------

async function admin(method: 'PUT' | 'DELETE' | 'GET', path: string, body?: unknown) {
  const res = await fetch(`http://${EMU}/${path}.json?ns=${NS}`, {
    method,
    headers: { Authorization: 'Bearer owner' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Emulator ${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const apps: FirebaseApp[] = [];
const dbs: Database[] = [];
let n = 0;

/** Ein Client wie die App – mit anonymer UID oder ganz ohne Anmeldung. */
function client(uid: string | null): Database {
  const app = initializeApp(
    { projectId: 'demo-pegel', databaseURL: `http://${EMU}?ns=${NS}` },
    `c${n++}`,
  );
  const db = getDatabase(app);
  connectDatabaseEmulator(
    db,
    EMU_HOST,
    EMU_PORT,
    uid ? { mockUserToken: { sub: uid, user_id: uid, firebase: { sign_in_provider: 'anonymous' } } as never } : undefined,
  );
  apps.push(app);
  dbs.push(db);
  return db;
}

const lobby = (db: Database, path = '') => ref(db, `lobbies/${CODE}${path}`);

/**
 * Wie in der App: dort hängt ein Abo auf der Lobby, die Transaktion startet
 * also mit dem echten Wert. Ohne Abo sähe sie zuerst `null` und bräche ab.
 */
async function subscribed(db: Database, path: string): Promise<() => void> {
  let off: () => void = () => {};
  await new Promise<void>((resolve) => {
    off = onValue(lobby(db, path), () => resolve());
  });
  return off;
}

/** Host-Übernahme genau wie in PartyContext: nur wenn noch der alte Host drinsteht. */
async function takeOver(db: Database, from: string, to: string) {
  const off = await subscribed(db, '/meta/host');
  try {
    return await runTransaction(lobby(db, '/meta/host'), (cur) => (cur === from ? to : undefined));
  } finally {
    off();
  }
}
const denied = (p: PromiseLike<unknown>) => expect(Promise.resolve(p)).rejects.toThrow(/permission[_ ]denied/i);
const allowed = (p: PromiseLike<unknown>) => expect(Promise.resolve(p)).resolves.not.toThrow();

function player(id: string, name: string, extra: Record<string, unknown> = {}) {
  const now = Date.now();
  return { id, name, color: 'indigo', joinedAt: now, lastSeen: now, online: true, ...extra };
}

/** Lobby wie nach createOnline + Beitritt eines Gasts. */
function seed(over: { status?: 'lobby' | 'playing'; hostLastSeen?: number; expiresAt?: number } = {}) {
  const now = Date.now();
  return admin('PUT', `lobbies/${CODE}`, {
    meta: {
      code: CODE,
      host: HOST,
      status: over.status ?? 'lobby',
      createdAt: now,
      updatedAt: now,
      expiresAt: over.expiresAt ?? now + 8 * H,
      ...(over.status === 'playing' ? { gameId: 'kings-cup', startedBy: HOST, startedAt: now } : {}),
    },
    players: {
      [HOST]: player(HOST, 'Host', over.hostLastSeen ? { lastSeen: over.hostLastSeen } : {}),
      [GUEST]: player(GUEST, 'Gast'),
    },
    avatars: { [GUEST]: 'data:image/jpeg;base64,AAAA' },
    ...(over.status === 'playing'
      ? { game: { id: 'kings-cup', startedAt: now, state: '{"n":1}' } }
      : {}),
  });
}

beforeAll(async () => {
  const res = await fetch(`http://${EMU}/.settings/rules.json?ns=${NS}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer owner' },
    body: RULES,
  });
  if (!res.ok) throw new Error(`Rules nicht geladen: ${res.status} ${await res.text()}`);
});

beforeEach(async () => {
  await admin('PUT', '', null);
});

afterAll(async () => {
  dbs.forEach((db) => goOffline(db));
  await Promise.all(apps.map((a) => deleteApp(a)));
});

// ---------- Angriffe: müssen scheitern ----------

describe('ohne Anmeldung', () => {
  it('liest keine Lobby, auch mit bekanntem Code', async () => {
    await seed();
    await denied(get(lobby(client(null))));
    await denied(get(lobby(client(null), '/meta')));
  });

  it('legt keine Lobby an', async () => {
    const now = Date.now();
    await denied(
      set(lobby(client(null)), {
        meta: { code: CODE, host: 'x', createdAt: now, expiresAt: now + H },
        players: { x: player('x', 'X') },
      }),
    );
  });

  it('übernimmt keinen Host, löscht keine Lobby', async () => {
    await seed();
    const anon = client(null);
    await denied(set(lobby(anon, '/meta/host'), 'x'));
    await denied(remove(lobby(anon)));
  });
});

describe('angemeldet, aber nur mit dem Code (kein Mitglied)', () => {
  it('kann nicht alle Lobbys auflisten', async () => {
    await seed();
    await denied(get(ref(client(EVIL), 'lobbies')));
  });

  it('übernimmt keinen Host, solange der Host da ist', async () => {
    await seed();
    await denied(set(lobby(client(EVIL), '/meta/host'), EVIL));
  });

  it('ändert keine fremden Spieler und keine fremden Avatare', async () => {
    await seed();
    const evil = client(EVIL);
    await denied(set(lobby(evil, `/players/${GUEST}/name`), 'gehackt'));
    await denied(update(lobby(evil, `/players/${GUEST}`), { zone: 'sober' }));
    await denied(remove(lobby(evil, `/players/${GUEST}`)));
    await denied(remove(lobby(evil, `/avatars/${GUEST}`)));
    await denied(set(lobby(evil, `/avatars/${GUEST}`), 'data:image/jpeg;base64,BBBB'));
  });

  it('überschreibt keine bestehende Lobby (Anlegen nur, wenn frei)', async () => {
    await seed();
    const now = Date.now();
    await denied(
      set(lobby(client(EVIL)), {
        meta: { code: CODE, host: EVIL, status: 'lobby', createdAt: now, expiresAt: now + H },
        players: { [EVIL]: player(EVIL, 'Evil') },
      }),
    );
  });

  it('löscht die Lobby nicht', async () => {
    await seed();
    await denied(remove(lobby(client(EVIL))));
  });

  it('schickt keine Aktionen in die Inbox', async () => {
    await seed({ status: 'playing' });
    await denied(push(lobby(client(EVIL), '/inbox'), { by: EVIL, at: Date.now(), action: '{}' }));
  });

  it('setzt keinen Spielstand', async () => {
    await seed({ status: 'playing' });
    await denied(set(lobby(client(EVIL), '/game/state'), '{"gewonnen":"evil"}'));
  });
});

describe('angemeldetes Mitglied, aber nicht Host', () => {
  async function joinedEvil() {
    await seed({ status: 'playing' });
    const evil = client(EVIL);
    await allowed(update(lobby(evil, `/players/${EVIL}`), player(EVIL, 'Evil')));
    return evil;
  }

  it('übernimmt keinen Host, solange der Host frisch ist', async () => {
    const evil = await joinedEvil();
    await denied(set(lobby(evil, '/meta/host'), EVIL));
    await denied(takeOver(evil, HOST, EVIL));
  });

  it('überschreibt den laufenden Spielstand nicht und beendet die Runde nicht', async () => {
    const evil = await joinedEvil();
    await denied(set(lobby(evil, '/game/state'), '{"gewonnen":"evil"}'));
    await denied(
      update(lobby(evil), { 'meta/status': 'lobby', 'meta/gameId': null, game: null, inbox: null }),
    );
  });

  it('verlängert die Lobby nicht und ändert den Film nicht (nur der Host)', async () => {
    const evil = await joinedEvil();
    await denied(update(lobby(evil, '/meta'), { expiresAt: Date.now() + 8 * H }));
    await denied(set(lobby(evil, '/meta/film'), { rolls: 40, developAfterH: 0 }));
  });

  it('schickt keine Aktion im Namen eines anderen', async () => {
    const evil = await joinedEvil();
    await denied(push(lobby(evil, '/inbox'), { by: GUEST, at: Date.now(), action: '{}' }));
  });

  it('löscht keine fremden Inbox-Nachrichten', async () => {
    const evil = await joinedEvil();
    await admin('PUT', `lobbies/${CODE}/inbox/m1`, { by: GUEST, at: Date.now(), action: '{}' });
    await denied(remove(lobby(evil, '/inbox/m1')));
  });

  it('wirft keine anderen Spieler hinaus und löscht die Lobby nicht', async () => {
    const evil = await joinedEvil();
    await denied(remove(lobby(evil, `/players/${GUEST}`)));
    await denied(remove(lobby(evil)));
  });

  it('kann seine Uhr nicht weit in die Zukunft stellen, um Host zu blockieren', async () => {
    const evil = await joinedEvil();
    await denied(update(lobby(evil, `/players/${EVIL}`), { lastSeen: Date.now() + 24 * H }));
  });
});

describe('alter Host nach einer Übernahme', () => {
  it('schreibt keinen Spielstand mehr (serverseitige Einzäunung)', async () => {
    await seed({ status: 'playing', hostLastSeen: Date.now() - 60_000 });
    const guest = client(GUEST);
    expect((await takeOver(guest, HOST, GUEST)).committed).toBe(true);
    const oldHost = client(HOST);
    await denied(set(lobby(oldHost, '/game/state'), '{"alt":true}'));
  });
});

describe('abgelaufene Lobby', () => {
  it('nimmt keine Schreibzugriffe mehr an', async () => {
    await seed({ expiresAt: Date.now() - 1000 });
    const guest = client(GUEST);
    await denied(update(lobby(guest, `/players/${GUEST}`), { lastSeen: Date.now() }));
    await denied(update(lobby(client(HOST), '/meta'), { expiresAt: Date.now() + H }));
  });
});

describe('Validierung bleibt erhalten', () => {
  it('lehnt zu lange Namen, fremde Felder und Übergrößen ab', async () => {
    await seed({ status: 'playing' });
    const guest = client(GUEST);
    await denied(set(lobby(guest, `/players/${GUEST}/name`), 'x'.repeat(25)));
    await denied(set(lobby(guest, `/players/${GUEST}/isAdmin`), true));
    await denied(set(lobby(client(HOST), '/game/state'), 'x'.repeat(200_001)));
    await denied(set(lobby(guest, `/avatars/${GUEST}`), 'javascript:alert(1)'));
  });
});

// ---------- Legitime Wege der App: müssen funktionieren ----------

describe('legitime Abläufe', () => {
  it('Host legt eine freie Lobby an und liest sie', async () => {
    const host = client(HOST);
    const now = Date.now();
    const res = await runTransaction(lobby(host), (cur) =>
      cur === null
        ? {
            meta: { code: CODE, host: HOST, status: 'lobby', createdAt: now, updatedAt: now, expiresAt: now + 8 * H },
            players: { [HOST]: player(HOST, 'Host') },
          }
        : undefined,
    );
    expect(res.committed).toBe(true);
    expect((await get(lobby(host, '/meta/host'))).val()).toBe(HOST);
  });

  it('Gast liest die Metadaten, tritt bei und schickt Herzschläge', async () => {
    await seed();
    const g = client('uid-neu-000000000000000000000');
    expect((await get(lobby(g, '/meta'))).exists()).toBe(true);
    await allowed(update(lobby(g, '/players/uid-neu-000000000000000000000'), player('uid-neu-000000000000000000000', 'Neu')));
    await allowed(
      update(lobby(g, '/players/uid-neu-000000000000000000000'), {
        lastSeen: Date.now(),
        online: true,
        zone: 'sober',
        driver: false,
        drinkIcon: 'beer',
        shots: 3,
      }),
    );
    await allowed(onDisconnect(lobby(g, '/players/uid-neu-000000000000000000000')).update({ online: false }));
  });

  it('Gast setzt und entfernt das eigene Profilbild', async () => {
    await seed();
    const guest = client(GUEST);
    await allowed(set(lobby(guest, `/avatars/${GUEST}`), 'data:image/jpeg;base64,CCCC'));
    await allowed(onDisconnect(lobby(guest, `/avatars/${GUEST}`)).remove());
    await allowed(remove(lobby(guest, `/avatars/${GUEST}`)));
  });

  it('Gast startet ein Spiel, solange die Lobby wartet', async () => {
    await seed();
    const guest = client(GUEST);
    const now = Date.now();
    await allowed(
      update(lobby(guest), {
        'meta/status': 'playing',
        'meta/gameId': 'kings-cup',
        'meta/startedBy': GUEST,
        'meta/startedAt': now,
        'meta/updatedAt': now,
        game: { id: 'kings-cup', startedAt: now, state: '{}', build: 'abc' },
        inbox: null,
      }),
    );
  });

  it('Gast schickt eine eigene Aktion, Host wendet sie an und räumt die Inbox', async () => {
    await seed({ status: 'playing' });
    const guest = client(GUEST);
    const host = client(HOST);
    const msg = await push(lobby(guest, '/inbox'), { by: GUEST, at: Date.now(), action: '{"type":"draw"}' });
    await allowed(set(lobby(host, '/game/state'), '{"n":2}'));
    await allowed(remove(lobby(host, `/inbox/${msg.key}`)));
  });

  it('Host hält die Lobby am Leben, setzt den Film, entfernt Inaktive und beendet die Runde', async () => {
    await seed({ status: 'playing' });
    const host = client(HOST);
    const now = Date.now();
    await allowed(update(lobby(host, '/meta'), { updatedAt: now, expiresAt: now + 8 * H }));
    await allowed(update(lobby(host), { 'meta/film': { rolls: 3, developAfterH: 12 }, 'meta/updatedAt': now }));
    await allowed(update(lobby(host), { [`players/${GUEST}`]: null, [`avatars/${GUEST}`]: null }));
    await allowed(
      update(lobby(host), {
        'meta/status': 'lobby',
        'meta/gameId': null,
        'meta/startedBy': null,
        'meta/startedAt': null,
        'meta/updatedAt': now,
        game: null,
        inbox: null,
      }),
    );
  });

  it('Host startet während einer Runde ein neues Spiel', async () => {
    await seed({ status: 'playing' });
    const now = Date.now();
    await allowed(
      update(lobby(client(HOST)), {
        'meta/status': 'playing',
        'meta/gameId': 'busfahrer',
        'meta/startedBy': HOST,
        'meta/startedAt': now,
        'meta/updatedAt': now,
        game: { id: 'busfahrer', startedAt: now, state: '{}' },
        inbox: null,
      }),
    );
  });

  it('Gast übernimmt den Host, wenn der Host verschwunden ist', async () => {
    await seed({ hostLastSeen: Date.now() - 60_000 });
    const guest = client(GUEST);
    expect((await takeOver(guest, HOST, GUEST)).committed).toBe(true);
  });

  it('Gast verlässt die Lobby und nimmt den eigenen Eintrag mit', async () => {
    await seed();
    const guest = client(GUEST);
    await allowed(update(lobby(guest), { [`players/${GUEST}`]: null, [`avatars/${GUEST}`]: null }));
  });

  it('Host löscht die Lobby beim Verlassen', async () => {
    await seed();
    await allowed(remove(lobby(client(HOST))));
  });

  it('Letztes Mitglied löscht die Lobby, wenn der Host längst weg ist', async () => {
    await seed({ hostLastSeen: Date.now() - 10 * 60_000 });
    await allowed(remove(lobby(client(GUEST))));
  });
});
