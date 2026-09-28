# Firebase oder Supabase?

Stand: September 2026. Die Grenzen der kostenlosen Stufen ändern sich, vor einer Entscheidung
kurz auf den Preisseiten gegenprüfen (Quellen am Ende).

## Kurzfassung

**Bleibt bei Firebase.** Für genau diese App, also Lobbys mit einem Host, der einen Spielstand
verteilt, ohne Konten und ohne hochgeladene Dateien, passt die Realtime Database besser als
Supabase. Sie ist schon gebaut und getestet, und ihre kostenlose Stufe trägt mehr Partien.

Supabase wird die bessere Wahl, **sobald** ihr eins davon wollt:

- Nutzerkonten und Profile über Geräte hinweg
- Dateien teilen (eigene Meme-Vorlagen, Fotos des Abends für alle)
- Auswertungen in SQL („welches Spiel wird am meisten gespielt")
- mehr als ~6 gleichzeitige Partys, **ohne** eine Kreditkarte zu hinterlegen

Und auch dann gibt es einen dritten Weg, der oft der beste ist: **Firebase für die Lobby
behalten und Supabase nur für das Neue dazunehmen** (siehe Abschnitt 4).

---

## 1. Die kostenlosen Stufen nebeneinander

| | Firebase Realtime DB (Spark) | Supabase (Free) |
|:--|:--|:--|
| Gleichzeitige Verbindungen | **100** | **200** Realtime-Verbindungen |
| Datenmenge | 1 GB | 500 MB Datenbank + 1 GB Dateien |
| Datenverkehr | **10 GB/Monat** Download | 5 GB/Monat Egress |
| Realtime-Nachrichten | nicht gezählt (nur Bytes) | **2 Mio./Monat**, eine Broadcast-Nachricht an 8 Geräte zählt 9-mal |
| Dateispeicher | nur mit Blaze-Tarif (seit 03.02.2026) | 1 GB inklusive |
| Pausiert bei Nichtnutzung | nie | **nach 1 Woche ohne Anfragen** |
| Projekte | beliebig viele | 2 aktive |
| Region | europe-west1 (Belgien), schon eingerichtet | Frankfurt wählbar |
| Offline/Abbruch-Erkennung | `onDisconnect`, im Code genutzt | Presence (anderes Modell) |
| Abfragen | nur Pfade, kein SQL | volles PostgreSQL |
| Konten | Firebase Auth (extra) | integriert |
| Open Source / selbst hostbar | nein | ja |
| Nächste Stufe | Blaze: nutzungsbasiert, die Grenze von 100 Verbindungen entfällt, erste 10 GB weiter frei | Pro: 25 $/Monat pauschal |

## 2. Nachgerechnet für diese App

Messung am Meme-Duell (acht Leute, fünf Runden, zwei Reaktionen je Meme): rund **480
Spielzüge**, Spielstand im Schnitt **5,7 KB**, jede Änderung geht an acht Geräte.

| | Firebase heute | Supabase (Broadcast-Aufbau, Abschnitt 5) |
|:--|:--|:--|
| Was zählt | Bytes: 480 × 5,7 KB × 8 ≈ **22 MB** | Nachrichten: je Zug Aktion + Stand ≈ 2 × 9 = 18, also ≈ **8 700** |
| Partien pro Monat kostenlos | 10 GB / 22 MB ≈ **450** | 2 Mio. / 8 700 ≈ **230** (und 5 GB Egress ≈ 230) |
| Partys gleichzeitig | 100 / 16 ≈ **6** | 200 / 16 ≈ **12** |

Heißt: Supabase erlaubt mehr Partys **gleichzeitig**, Firebase mehr Partien **im Monat**. Für
eine Party-App mit Spitzen am Freitag- und Samstagabend ist die Gleichzeitigkeit der echte
Engpass. Der lässt sich bei Firebase aber für praktisch null Euro lösen:

> **Firebase auf Blaze umstellen und ein Budget-Limit setzen** (Google Cloud Console →
> Abrechnung → Budgets & Benachrichtigungen, z. B. 5 €). Die ersten 10 GB bleiben frei, danach
> kostet 1 GB rund 1 $. 1 000 Meme-Duelle im Monat kämen auf etwa 12 $. Die Grenze von 100
> Verbindungen fällt weg. Kein Code ändert sich.

## 3. Wann was

| Situation | Empfehlung |
|:--|:--|
| So wie jetzt, Freundeskreis, ein paar Partys pro Woche | **Firebase Spark**, nichts tun |
| App im Store, Wochenend-Spitzen > 6 Partys | **Firebase Blaze** mit Budget-Alarm |
| Eigene Meme-Vorlagen hochladen und mit der Lobby teilen | **Supabase Storage zusätzlich** (Abschnitt 4), Lobby bleibt bei Firebase |
| Konten, Freundeslisten, Statistiken über Abende | **Supabase**, dann lohnt der Umzug (Abschnitt 5) |
| Keine Kreditkarte, trotzdem > 6 Partys gleichzeitig | Supabase, wegen der Pause einen Keep-alive einplanen |

---

## 4. Der Mittelweg: Supabase nur für Dateien

Wollt ihr irgendwann **eigene Meme-Vorlagen hochladen** (z. B. ein Foto aus der Einwegkamera als
Vorlage für die ganze Runde), braucht es Dateispeicher. Firebase Storage kostet dafür den
Blaze-Tarif, Supabase hat 1 GB frei.

1. Supabase-Projekt anlegen (Region Frankfurt), Bucket `vorlagen`, öffentlich lesbar, Upload
   nur über eine signierte URL.
2. Das Handy lädt das Bild hoch (verkleinert auf 720 px, WebP ≈ 40 KB) und schickt über die
   Firebase-Lobby nur die **URL** statt einer Vorlagen-ID: `{ t: "https://…/abc.webp", x: [...] }`.
3. `templateOf()` gibt für URLs eine Vorlage mit zwei Standardfeldern (oben/unten) zurück.
4. Aufräumen: eine Supabase-Cron-Funktion löscht Dateien älter als 24 h.
5. **Datenschutz:** Ab dann verlässt ein Bild das Gerät. Das widerspricht dem heutigen
   Versprechen („nie ein Bild") und gehört vorher in `src/legal/site.ts`, mit Einwilligung
   beim Hochladen.

Die Lobby bleibt bei Firebase, keine Migration, kein Risiko.

---

## 5. Falls ihr ganz wechselt: Umzug ohne Ausfall

Die gute Nachricht steht schon in `docs/ARCHITEKTUR.md`: **Der gesamte Firebase-Code steckt in
zwei Dateien**, `src/lib/firebase.ts` und `src/features/party/PartyContext.tsx`. Alle Spiele
kennen nur die `PartyValue`-Schnittstelle. Kein Spiel muss angefasst werden.

Der Trick für „ohne Fehler": **beide Backends laufen eine Zeit lang parallel, und der
Lobby-Code entscheidet, welches gilt.** Die Security Rules erlauben heute schon Codes mit 4–6
Zeichen, die App erzeugt aber nur 4. Neue Supabase-Lobbys bekommen 5 Zeichen. Jede
App-Version findet damit ihre Lobbys, und niemand landet in einer Lobby, die sein Handy nicht
versteht:

```
Code  A7K2   → Firebase   (alte und neue App-Versionen)
Code  A7K2B  → Supabase   (nur neue App-Versionen)
```

Eine alte App, die einen 5-stelligen Code eintippt, meldet „Lobby nicht gefunden". Dafür
bekommt die neue Version einen Hinweis: „Lobby gibt es nicht? Die anderen sollten die App
aktualisieren."

### Schritt 1: Eine Schnittstelle einziehen (noch ohne Supabase)

`PartyContext.tsx` ruft heute Firebase direkt auf. Daraus wird ein `LobbyTransport`:

```ts
// src/features/party/transport.ts
export interface LobbyTransport {
  create(meta: LobbyMeta, me: RemotePlayer): Promise<void>;
  join(code: string, me: RemotePlayer): Promise<void>;
  leave(): void;
  /** Liefert jeden neuen Stand der Lobby (meta, players, game). */
  subscribe(code: string, onSnapshot: (s: LobbySnapshot | null) => void): () => void;
  /** Nur Host: Aktionen der anderen. */
  onActions(code: string, handle: (a: GameAction[]) => Promise<void>): () => void;
  sendAction(code: string, action: GameAction): void;
  writeState(code: string, state: string): Promise<void>;
  heartbeat(code: string, patch: Partial<RemotePlayer>): void;
  /** Atomar: übernimmt den Host, wenn der alte seit `staleMs` weg ist. */
  claimHost(code: string, me: string, staleMs: number): Promise<boolean>;
}
```

`FirebaseTransport` bekommt genau den Code, der heute im Kontext steht. **Dieser Schritt ändert
kein Verhalten** und lässt sich allein ausliefern. `src/features/party/online.test.tsx`
spielt die Lobby schon heute gegen eine Datenbank im Arbeitsspeicher durch. Diese Tests werden
zu **Vertragstests**, die jede Transport-Implementierung bestehen muss.

### Schritt 2: Supabase einrichten

Projekt in Frankfurt anlegen, dann im SQL-Editor:

```sql
-- Nur der Schnappschuss des Spielstands. Spielzüge laufen über Realtime Broadcast.
create table public.lobbies (
  code        text primary key check (code ~ '^[A-Z0-9]{5}$'),
  host        text not null check (length(host) <= 64),
  meta        jsonb not null default '{}',
  game        jsonb,                          -- { id, startedAt, state: "<JSON-String>" }
  host_epoch  int  not null default 0,        -- steigt bei jeder Host-Übernahme
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '8 hours'
);

alter table public.lobbies enable row level security;

-- Ohne Konten: lesen und schreiben darf, wer den Code kennt, solange die Lobby lebt.
-- Dasselbe Schutzniveau wie die Firebase-Regeln heute.
create policy "lobby lesen"   on public.lobbies for select using (expires_at > now());
create policy "lobby anlegen" on public.lobbies for insert with check (expires_at <= now() + interval '12 hours');
create policy "lobby ändern"  on public.lobbies for update using (expires_at > now());

-- Host-Übernahme ohne Wettlauf: nur wer die aktuelle Epoche kennt, gewinnt.
create function public.claim_host(p_code text, p_me text, p_epoch int)
returns boolean language sql security definer as $$
  update public.lobbies
     set host = p_me, host_epoch = host_epoch + 1, updated_at = now()
   where code = p_code and host_epoch = p_epoch and expires_at > now()
  returning true;
$$;

-- Aufräumen, kostenlos über pg_cron (Database → Extensions → pg_cron aktivieren):
select cron.schedule('lobbies-aufraeumen', '*/30 * * * *',
  $$ delete from public.lobbies where expires_at < now() $$);
```

**Gegen die Pause nach einer Woche:** eine GitHub Action, die zweimal pro Woche die Datenbank
anfragt.

```yaml
# .github/workflows/supabase-keepalive.yml
on:
  schedule: [{ cron: '0 12 * * 1,4' }]
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: >
          curl -fsS "$URL/rest/v1/lobbies?select=code&limit=1"
          -H "apikey: $KEY"
        env:
          URL: ${{ secrets.SUPABASE_URL }}
          KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

### Schritt 3: `SupabaseTransport`: was worauf abgebildet wird

| Heute (Firebase) | Supabase | Anmerkung |
|:--|:--|:--|
| `players/*` + Heartbeat alle 20 s + `lastSeen` | **Presence** im Kanal `lobby:<code>` | Abmelden beim Verbindungsabbruch passiert automatisch. Der Heartbeat entfällt, `online: false` kommt aus Presence. |
| `onDisconnect().update({online:false})` | Presence `leave` | dito |
| `inbox/*` (nur der Host liest) | **Broadcast** `action` | Der Host reduziert wie heute. |
| `game/state` schreiben | **Broadcast** `state` **und** `update lobbies set game=…` | Broadcast für Tempo, die Tabelle für alle, die neu dazukommen oder die Verbindung verloren haben. |
| `runTransaction` für Host-Übernahme | RPC `claim_host` | Epoche statt Transaktion. |
| `expiresAt` + Security Rules | `expires_at` + RLS + pg_cron | Supabase räumt sogar selbst auf, Firebase nicht. |
| `.info/connected` | Kanalstatus `SUBSCRIBED` / `CHANNEL_ERROR` | für die Verbindungsanzeige |
| Spielstand als JSON-String | **bleibt JSON-String** | Nicht wegen leerer Arrays (die kann Postgres), sondern damit `encodeState`/`decodeState` und alle Tests gleich bleiben. |

Ein Detail, das man leicht übersieht: Broadcast stellt **nicht zu, wer gerade nicht verbunden
ist**. Ein Handy, das kurz im Funkloch war, lädt nach dem Wiederverbinden den Stand aus der
Tabelle, bevor es wieder auf Broadcasts hört. Genau dafür ist die Tabelle da.

### Schritt 4: Parallelbetrieb und Rollout

1. `VITE_LOBBY_BACKEND=firebase|supabase|split` in `.env`. Im Modus `split` wählt die App
   beim **Anlegen** zufällig (erst 10 %, dann 50 %, dann 100 %), beim **Beitreten** entscheidet
   die Code-Länge.
2. Fehler zählen: Den Ausgang jedes `create`/`join` mit Backend nach `console` und, falls
   vorhanden, in ein Crash-Tool schreiben. Steigt die Fehlerquote bei Supabase, geht der
   Anteil zurück auf 0 %, **ohne Deploy**, wenn der Schalter aus einer Remote-Config kommt, sonst
   mit einem Deploy.
3. **Native Apps hängen hinterher:** Store-Updates brauchen Tage, manche Leute aktualisieren
   nie. Firebase deshalb erst abschalten, wenn in der Firebase-Konsole zwei Wochen lang keine
   neuen 4-stelligen Lobbys mehr auftauchen.
4. Danach: `firebase` aus `package.json` entfernen (heute 163 KB, komprimiert 49 KB;
   `@supabase/supabase-js` ist ähnlich groß, kleiner wird die App dadurch also kaum),
   Datenschutzerklärung (`src/legal/site.ts`) auf Supabase als Auftragsverarbeiter umstellen,
   den Auftragsverarbeitungsvertrag (DPA) von Supabase abschließen, `docs/FIREBASE.md` ersetzen.

### Schritt 5: Was vor jedem Rollout-Schritt grün sein muss

- [ ] Vertragstests (`online.test.tsx`) gegen `FirebaseTransport` **und** `SupabaseTransport`
- [ ] Host verliert das Netz → nach 45 s übernimmt jemand, **genau einer** (zwei Handys
      gleichzeitig `claim_host` probieren lassen)
- [ ] Handy 30 s im Flugmodus → kommt zurück und sieht den aktuellen Stand
- [ ] Letzte Person geht → Lobby verschwindet (bzw. läuft nach 8 h ab)
- [ ] Alte App-Version (4-stelliger Code) und neue spielen weiter zusammen
- [ ] Ein Meme-Duell mit 8 Handys komplett durch, ohne dass die Abstimmung hängt

---

## Quellen

- [Firebase: Realtime Database Limits](https://firebase.google.com/docs/database/usage/limits)
- [Firebase: Cloud Storage braucht seit 03.02.2026 den Blaze-Tarif](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)
- [Supabase: Pricing](https://supabase.com/pricing)
- [Supabase: Realtime Pricing](https://supabase.com/docs/guides/realtime/pricing)
- [Supabase: Wie Realtime-Nachrichten gezählt werden](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages)
