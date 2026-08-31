# Ein neues Spiel hinzufügen

Es gibt zwei Wege. Der erste deckt die meisten Trinkspiele ab und braucht keine
React-Kenntnisse.

---

## Weg 1: Kartenspiel (eine Datei, kein UI-Code)

Alles, was auf „Karte zeigen → jemand macht etwas → jemand trinkt" hinausläuft, baut
`createCardGame()` fertig zusammen: Kartenstapel, Zugreihenfolge, Härtegrad-Regler,
Trinkansage und Rundenzähler.

```ts
// src/games/kategorien/index.ts
import { createCardGame } from '../card-engine/createCardGame';

export const kategorien = createCardGame({
  id: 'kategorien',
  name: 'Kategorien',
  tagline: 'Reihum ein Beispiel. Wer hängt, trinkt.',
  icon: 'cards',
  accent: 'var(--mint)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '10-20 Min',
  intensity: 1,
  tags: ['handy-weg', 'schnell'],
  howTo: ['Ein Handy reicht.', 'Kategorie vorlesen, reihum nennen.', 'Wer hängt, trinkt.'],

  actor: 'turn',        // 'turn' = eine Person am Zug, 'none' = Karte gilt für alle
  baseSips: 3,          // 3 = normal, 1 = mild, 6 = Strafe
  drink: 'actor',       // 'actor' | 'all' | 'none' | 'self-declare'
  resolveLabel: 'Erledigt',
  heatSelectable: true, // blendet den Härtegrad-Regler ein

  cards: [
    { text: 'Biersorten', heat: 1 },
    { text: 'Dinge, die man bereut', heat: 2 },
    { text: 'Alle trinken: Serien', target: 'all', heat: 1, sips: 2 },
  ],
});
```

Danach in `src/games/registry.ts` importieren und in das `GAMES`-Array eintragen. Fertig —
Spieleliste, Filter, Detailseite, Lobby-Vorschläge und Trinkansage funktionieren sofort.

### Die Felder im Detail

> `icon` ist ein Name aus `src/components/icons`. Die App benutzt bewusst keine
> Emojis: die sehen auf iOS, Android und Windows unterschiedlich aus und lassen
> sich nicht einfärben. Fehlt ein passendes Icon, ergänze es dort – ein Pfad im
> 24×24-Raster, `currentColor`, Strichstärke 1.7.

| Feld | Bedeutung |
|:--|:--|
| `actor` | `'turn'`: eine Person ist am Zug. `'none'`: die Karte gilt der ganzen Runde. |
| `modes` | Auswahl vor dem Ziehen, z. B. Wahrheit/Pflicht. Karten filtern über `mode`. |
| `drink` | Wer nach dem Erledigen trinkt. `'self-declare'` = jede Person entscheidet selbst (Ich hab noch nie). |
| `refuseLabel` / `refuseSips` | Blendet einen Kneifen-Knopf ein und setzt die Strafe. |
| `heatSelectable` | Zeigt den Härtegrad-Regler. Karten mit `heat` über der Einstellung werden ausgeblendet. |
| `allowCustomCards` | Erlaubt eigene Karten im Spieldetail. Sie liegen lokal; in einer Lobby mischt der Host seine mit in den Stapel. |
| Karte: `target` | `'actor'` oder `'all'` — überschreibt `drink` für diese eine Karte. |
| Karte: `sips` | Überschreibt `baseSips` für diese eine Karte. `0` = niemand trinkt (z. B. Wasserrunde). |

---

## Weg 2: Eigene Mechanik

Braucht das Spiel Timer, Teams, Texteingaben oder geheime Informationen, schreibst du eine
`GameDefinition` selbst — ein Zustand, ein Reducer, eine Komponente.

```tsx
// src/games/mein-spiel/index.tsx
import type { GameDefinition, GameRuntime, GameActionInput } from '../types';
import { GameFrame } from '../shared/GameFrame';
import { DrinkCall } from '../shared/DrinkCall';
import { BigCard } from '../shared/pieces';

interface State { runde: number; dran: string | null }

export const meinSpiel: GameDefinition<State> = {
  id: 'mein-spiel',
  name: 'Mein Spiel',
  /* … Metadaten wie oben … */
  requiresOwnDevice: false,

  createState: (players) => ({ runde: 1, dran: players[0]?.id ?? null }),

  reduce: (state, action, players) => {
    if (action.type !== 'next') return state;
    const i = players.findIndex((p) => p.id === state.dran);
    return { runde: state.runde + 1, dran: players[(i + 1) % players.length].id };
  },

  Component: ({ state, players, me, dispatch, quit, online }: GameRuntime<State>) => {
    const send = (a: GameActionInput) => dispatch(a);
    const dran = players.find((p) => p.id === state.dran) ?? me;
    return (
      <GameFrame title="Mein Spiel" accent="var(--teal)" onQuit={quit}>
        <BigCard kicker={`Runde ${state.runde}`}>{dran.name} ist dran.</BigCard>
        <DrinkCall player={dran} baseSips={3} source="mein-spiel" />
        <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
          Weiter
        </button>
      </GameFrame>
    );
  },
};
```

### Fünf Regeln, an die du dich halten musst

1. **`reduce` läuft nur beim Host.** Zufall (`Math.random`, `Date.now`) ist dort erlaubt und
   erwünscht — nur so sehen alle dasselbe gemischte Deck.
2. **Der Zustand muss durch `JSON.stringify` und zurück überleben.** Keine `Map`, kein `Set`,
   keine `Date`-Objekte, keine Funktionen. Zeitstempel als Zahl. Aus demselben Grund liegt
   der Kartenstapel als *Inhalt* im Zustand und nicht als Index: eigene Karten würden die
   Nummerierung sonst zwischen den Geräten verschieben.
3. **Nie eigene Schluckzahlen ausrechnen.** Gib `baseSips` an `<DrinkCall>` und lass die
   Engine übersetzen. Nur so bekommt jede Person die Menge, die zu ihrem Körper und ihrem
   Getränk passt.
4. **Spielerlisten mit der Lobby abgleichen.** Leute kommen und gehen mitten im Spiel.
   `reduce` bekommt die aktuelle Liste als drittes Argument — nutze sie.
5. **`online` beachten.** Ist `online === false`, teilen sich alle ein Handy: dann darf das
   Gerät auch für die Person am Zug tippen. Braucht dein Spiel geheime Informationen, setze
   `requiresOwnDevice: true` — die App weist dann auf die Lobby hin.

### Bausteine, die schon da sind

| Import | Was es tut |
|:--|:--|
| `GameFrame` | Kopfzeile mit Titel, Akzentfarbe und Beenden-Knopf |
| `DrinkCall` / `DrinkCallList` | Persönliche Trinkansage samt „Getrunken"-Knopf und Log-Eintrag |
| `BigCard` | Die große Karte in der Mitte |
| `Choice` | Große Auswahlknöpfe |
| `Countdown`, `Ring` | Timer-Anzeigen |
| `PlayerChip`, `WaitingFor` | Spieleranzeige, Warten-auf-Zustand |
| `PlayingCard`, `fullDeck()`, `cardFromIndex()` | Französisches Blatt |
| `Icon`, `HeatIcons` | Das Icon-Set – nie Emojis verwenden |
| `Avatar` | Monogramm-Avatar aus Name und Farbe |
| `shuffle()`, `pick()` | Zufall aus `src/lib/format.ts` |
| `haptic()` | Vibrationsfeedback |

---

## Checkliste vor dem Commit

- [ ] `id` ist eindeutig und identisch mit dem Ordnernamen
- [ ] `minPlayers` ≥ 3, `maxPlayers` ≤ 16
- [ ] `howTo` erklärt das Spiel in zwei bis drei Sätzen
- [ ] In `src/games/registry.ts` eingetragen
- [ ] `npm test` läuft durch — die Registry-Tests prüfen jedes Spiel automatisch auf
      vollständige Metadaten, JSON-Fähigkeit des Zustands und Robustheit gegen unbekannte
      Aktionen
