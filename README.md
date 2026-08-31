# Pegel — Scientific Drinking Game

> Drink more suffer less.

Eine mobile-first Webapp für Trinkspiele auf Partys. Statt pauschaler „Trink 3 Schlucke"
rechnet die App jede Spielansage auf **Körperdaten und Getränk der einzelnen Person** um —
mit dem Ziel, einen angenehmen Pegel zu erreichen und zu **halten**, statt ihn zu überschreiten.

Ausgelegt auf **4–16 Spieler**, entweder mit einem geteilten Handy oder mit einer Lobby,
in der jede Person ihr eigenes Gerät benutzt.

---

## Was drin ist

| Bereich | Status |
|:--|:--|
| Onboarding (Name, Alter, Gewicht, Größe, Magen, Getränk, Zielpegel) | fertig |
| BAC-Engine: Widmark + Watson-Körperwasser + Resorptionsmodell | fertig |
| Individuelle Schluckberechnung pro Spielzug (Pegel erreichen / halten) | fertig |
| Restalkohol-Rechner mit Ampel und „Nüchtern um" | fertig |
| Verlaufs- und Prognosegrafik des Pegels | fertig |
| Lobby über 4-stelligen Code (Firebase Realtime Database) | fertig |
| Pass-&-Play auf einem Handy, inkl. Körperdaten der Mitspieler | fertig |
| 9 Spiele, davon 4 mit „Handy weglegen" | fertig |
| Plugin-System für neue Spiele | fertig |
| Alkoholfreier Modus, Altersprüfung, Wasser-Erinnerung | fertig |
| Dark & Light Mode, installierbar als PWA-Shortcut | fertig |
| Eigenes SVG-Icon-Set statt Emojis, Monogramm-Avatare | fertig |

### Die Spiele

| Spiel | Kurz | Handys |
|:--|:--|:--|
| Wahrheit oder Pflicht | Klassiker mit drei Härtegraden und Notausgang | 1 reicht |
| Ich hab noch nie | Handy in die Mitte, alle anderen weg | 1 reicht |
| Ring of Fire | Kings Cup mit virtuellem Kartendeck | 1 reicht |
| Chaos-Roulette | Gruppenaufgaben, Duelle, Bewegung | 1 reicht |
| Wortbombe | Kategorie nennen und weitergeben, bevor es knallt | 1 reicht |
| Tabu Rush | Zwei Teams, 60 Sekunden, verbotene Wörter | 1 reicht |
| Meme Battle | Prompt, Pointe tippen, anonym abstimmen | eigene nötig |
| Top Ten | Geheime Zahl 1–10, Antworten sortieren | eigene nötig |
| Busfahrer | Vier Fragen, dann die lange Fahrt | 1 reicht |

---

## Loslegen

```bash
npm install
npm run dev        # Dev-Server
npm test           # 66 Tests (Engine + alle Spiel-Reducer)
npm run typecheck
npm run build      # Produktions-Build nach dist/
```

Die Firebase-Datenbank ist fest hinterlegt — niemand muss beim ersten Start irgendetwas
eintragen. Für eine eigene Instanz reicht `VITE_FIREBASE_DB_URL=…` in einer `.env.local`.

### Einmalig nötig: Security Rules setzen

Ohne passende Rules verweigert die Datenbank jeden Zugriff und die Lobby bleibt leer.
Die Rules liegen versioniert im Repo:

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only database
```

Details und die Begründung stehen in [`docs/FIREBASE.md`](docs/FIREBASE.md).

---

## Wie die Berechnung funktioniert

Kurzfassung — ausführlich in [`docs/WISSENSCHAFT.md`](docs/WISSENSCHAFT.md).

1. **Verteilungsfaktor r** aus Geschlecht — oder, wenn die Körpergröße bekannt ist, aus dem
   Körperwasser nach **Watson** (`r = TBW / kg / 0,806`). Das ist deutlich individueller als
   die pauschalen Tabellenwerte.
2. **Resorption**: Alkohol wirkt nicht sofort. Jeder Drink steigt exponentiell ins Blut
   (τ = 9/16/26 Minuten je nach Magenfüllung). Ohne das würde die App direkt nach einem Shot
   viel zu viel anzeigen — und eine Minute später viel zu wenig.
3. **Abbau** mit 0,15 ‰/h für die Live-Anzeige, mit **0,10 ‰/h** für alle Sicherheitsaussagen
   („nüchtern um", Fahr-Check). Im Zweifel lieber zu spät grün als zu früh.
4. **Schluckberechnung**: Der noch nicht resorbierte Alkohol zählt bereits als getrunken.
   Deshalb bekommt niemand direkt nach einem Shot noch einen hinterher.
5. **Deckel**: Über dem Zielpegel gibt es 0 Schlucke, und ein harter Deckel bei 0,8 ‰
   überschreibt jede Spielansage.

Ergebnis einer simulierten 3-Stunden-Runde (alle 12 Minuten eine Ansage, Ziel 0,4 ‰):

```
Max   (85 kg, Bier)     5 → 4 → 3 → 2 → 2 → 1 Schlucke     49 g Alkohol
Lisa  (60 kg, Cocktail) 2 → 1 → 1 → 0 → 1 → 0 Schlucke     28 g Alkohol
Nina  (55 kg, Shots)    1 → 0 → 1 → 0 → 0 → 0 Shots        25 g Alkohol
```

Alle drei landen bei etwa 0,3 ‰ und bleiben dort — mit sehr unterschiedlichen Mengen.

---

## Neues Spiel hinzufügen

Ein reines Kartenspiel ist **eine Datei**:

```ts
// src/games/mein-spiel/index.ts
import { createCardGame } from '../card-engine/createCardGame';

export const meinSpiel = createCardGame({
  id: 'mein-spiel',
  name: 'Mein Spiel',
  tagline: 'Kurzbeschreibung',
  icon: 'target',
  accent: 'var(--teal)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '10-20 Min',
  intensity: 2,
  tags: ['handy-weg'],
  howTo: ['Regel 1', 'Regel 2'],
  actor: 'turn',
  baseSips: 3,
  drink: 'actor',
  cards: [{ text: 'Erste Karte', heat: 1 }],
});
```

Dann eine Zeile in `src/games/registry.ts`. Übersicht, Filter, Lobby, Spielbildschirm,
Trinkansagen und Statistik ziehen sich alles Weitere aus der Definition.
Für Spiele mit eigener Mechanik siehe [`docs/SPIEL-HINZUFUEGEN.md`](docs/SPIEL-HINZUFUEGEN.md).

---

## Datenschutz in einem Satz

Name, Alter, Gewicht, Größe und das komplette Trink-Log liegen ausschließlich im
`localStorage` des Geräts. In eine Lobby gehen nur Spitzname, Avatar-Emoji und das Symbol
des Getränks. Gesundheitsdaten verlassen das Gerät nie — deshalb rechnet auch jedes Gerät
seine eigene Schluckzahl selbst aus.

## Disclaimer

Alle Werte sind Schätzungen. Individuelle Faktoren (Medikamente, Krankheit, Müdigkeit,
Ernährung, Tagesform) verändern die Wirkung von Alkohol erheblich. Diese App ersetzt keine
medizinische Beratung und ist kein Messgerät. **Fahre niemals unter Alkoholeinfluss.**
