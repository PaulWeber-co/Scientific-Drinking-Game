# Scientific Drinking Game -- Team Basics

## Was ist das?

Eine mobile-first Webapp fuer Trinkspiele auf Partys. Die App berechnet basierend auf Koerperdaten und dem gewaaehlten Getraenk individuelle Schluckmengen, damit jeder Spieler einen angenehmen Pegel erreicht und haelt -- ohne es zu uebertreiben.

### Kernfeatures

1. **Onboarding** -- Name, Alter, Gewicht, Geschlecht (lokal gespeichert, kein Account)
2. **Getraenke-Auswahl** -- Bier, Wein, Cocktails, Shots etc. mit hinterlegtem Alkoholgehalt pro Schluck
3. **BAC-Engine** -- Widmark-Formel: berechnet individuell, wie viele Schluecke noetig sind, um den "Sweet Spot" (0.3-0.5 Promille) zu erreichen und zu halten
4. **Individuelle Schluck-Ausgabe** -- Trinkspiele geben personalisierte Schluckzahlen aus (Bier-Trinker bekommt mehr Schluecke als Cocktail-Trinker)
5. **Restalkohol-Rechner** -- "Nuechtern um X Uhr", Ampel-System fuer Fahrtuechtigkeits-Check am naechsten Morgen
6. **Lobby-System** -- Spieler treten ueber Code bei und spielen gemeinsam auf verschiedenen Geraeten
7. **Spiele als Plugins** -- Modulares System, neue Spiele = neuer Ordner + 1 Zeile in der Registry

---

## Tech Stack

| Was | Womit | Warum |
|:---|:---|:---|
| Framework | React 19 + Vite | Standard, grosses Oekosystem, schneller Dev-Server |
| Sprache | TypeScript | Typsicherheit fuer Berechnungslogik und Plugin-Interfaces |
| Styling | Vanilla CSS (Custom Properties) | Volle Kontrolle, kein Framework-Lock-in |
| Lokaler State | Zustand | Leichtgewichtig, built-in localStorage-Middleware |
| Echtzeit-Sync | Firebase Realtime DB | Lobby-Sync ohne eigenen Server, Free Tier reicht |
| Routing | React Router v7 | Lazy Loading fuer Spiele-Module |
| Hosting | GitHub Pages (oder Vercel) | Kostenlos, automatisches Deployment |
| Tests | Vitest + Testing Library | In Vite integriert |
| Linting | ESLint + Prettier | Konsistenter Code-Stil |



src/
  app/                    # App Shell, Routing, Layout
    App.tsx
    Router.tsx
    Layout.tsx
  components/             # Shared/Wiederverwendbare Komponenten
    ui/                   # Buttons, Inputs, Cards, etc.
    disclaimer/           # Disclaimer-Banner
  features/               # Feature-Module
    onboarding/           # Onboarding-Flow
    drink-selector/       # Getraenke-Auswahl UI
    bac-calculator/       # BAC-Anzeige, Restalkohol-Rechner
    lobby/                # Lobby erstellen/beitreten
  games/                  # Spiele-Plugin-System
    registry.ts           # Zentrale Registry
    types.ts              # Shared Interfaces (GameDefinition, DrinkDefinition, etc.)
    truth-or-dare/        # Erstes Spiel
    kings-cup/            # Zweites Spiel
    busfahrer/            # Drittes Spiel
  engine/                 # Kernlogik (Framework-unabhaengig)
    bac.ts                # Widmark-Formel, BAC-Berechnung
    sip-calculator.ts     # Schluck-Berechnung pro Getraenk/Spieler
    residual-alcohol.ts   # Restalkohol-Rechner
    drink-catalog.ts      # Getraenke-Datenbank
    age-check.ts          # Altersverifikation
  store/                  # Zustand Stores
    user-store.ts         # Profildaten
    drink-store.ts        # Getraenke-Auswahl + Drink-Log
    game-store.ts         # Aktuelles Spiel
  lib/                    # Utilities, Firebase-Config, etc.
    firebase.ts
    constants.ts
  styles/                 # Globale CSS
    variables.css
    reset.css
    global.css
public/
  index.html
```

### Code-Konventionen

- **Sprache im Code**: Englisch (Variablen, Funktionen, Kommentare)
- **Sprache in der UI**: Deutsch
- **Komponenten**: Funktionale Komponenten, kein Class-based React
- **Exports**: Named Exports bevorzugen (kein `export default` ausser fuer Seiten)
- **CSS**: BEM-aehnliche Klassennamen, CSS Custom Properties fuer alle Farben/Abstaaende
- **Tests**: Jede Datei in `engine/` braucht einen Test. UI-Tests fuer kritische Flows (Onboarding, Getraenke-Auswahl).

---



### Vor Phase 2 noetig


- [ ] **Firebase CLI**: `npm install -g firebase-tools`

  - Realtime Database aktivieren (Free Spark Plan)
  - Security Rules konfigurieren (nur Lobby-Pfade beschreibbar)

### Ggf. spaeter

- [ ] **Vercel Account** (falls wir von GitHub Pages wechseln)

---




## Offene Punkte (bitte abstimmen)

2. **Hosting**: GitHub Pages oder Vercel?
3. **Design**: Farbpalette, Font -- definieren wir in Phase 1 zusammen
4. **Erstes Spiel**: Wahrheit oder Pflicht ok?
