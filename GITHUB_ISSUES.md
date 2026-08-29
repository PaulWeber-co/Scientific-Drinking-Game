# GitHub Issues -- Scientific Drinking Game

> GitHub-API-Zugang ist nicht konfiguriert (401 Bad Credentials). Die Issues koennen manuell oder per `gh` CLI erstellt werden. Am Ende dieses Dokuments stehen die `gh`-Befehle zum Copy-Pasten.

---

## Phase 1: Foundation, Onboarding & BAC-Engine

### Issue 1: Projekt-Setup: Vite + React + TypeScript initialisieren

**Labels:** `setup`, `priority: high`, `phase-1`

**Beschreibung:**
Projekt mit Vite, React 19 und TypeScript aufsetzen. Grundlegende Entwicklungsumgebung konfigurieren.

**Aufgaben:**
- Vite-Projekt mit React + TypeScript Template initialisieren
- ESLint konfigurieren (mit TypeScript-Plugin)
- Prettier konfigurieren (.prettierrc)
- Vitest als Test-Runner einrichten
- EditorConfig anlegen
- .gitignore pruefen/erweitern
- package.json Scripts definieren (dev, build, test, lint)

**Akzeptanzkriterien:**
- `npm run dev` startet den Dev-Server ohne Fehler
- `npm run build` erzeugt ein produktionsfaehiges Bundle
- `npm run lint` laeuft durch ohne Fehler
- `npm run test` fuehrt Vitest aus (auch ohne Tests)
- TypeScript strict mode ist aktiviert
- ESLint + Prettier sind konfiguriert und konsistent

---

### Issue 2: CI/CD: GitHub Actions Pipeline + Deployment auf GitHub Pages

**Labels:** `setup`, `priority: high`, `phase-1`

**Beschreibung:**
Automatisches Deployment auf GitHub Pages via GitHub Actions einrichten. Bei jedem Push auf `main` soll die App automatisch gebaut und deployed werden.

**Aufgaben:**
- GitHub Actions Workflow erstellen (.github/workflows/deploy.yml)
- Vite Build fuer GitHub Pages konfigurieren (base path)
- Deployment auf GitHub Pages via Actions
- Lint + Test als CI-Step vor dem Build

**Akzeptanzkriterien:**
- Push auf `main` triggert automatisches Deployment
- Die App ist unter der GitHub Pages URL erreichbar
- Lint und Tests laufen als CI-Checks bei Pull Requests
- Build bricht ab, wenn Lint oder Tests fehlschlagen

---

### Issue 3: Design-System: CSS Custom Properties + Mobile-first Basis-Layout

**Labels:** `design`, `priority: high`, `phase-1`

**Beschreibung:**
Grundlegendes Design-System mit CSS Custom Properties definieren. Mobile-first Layout als Grundgeruest fuer alle Screens.

**Aufgaben:**
- CSS Reset/Normalize einbinden
- CSS Custom Properties definieren: Farben, Schriftgroessen, Abstaende, Border-Radii
- Google Font einbinden (z.B. Inter oder Outfit)
- Mobile-first Basis-Layout (App Shell mit Header/Content/Footer)
- Dark Mode als Standard (Party-Kontext)
- Responsive Breakpoints definieren
- Grundlegende UI-Komponenten stylen (Button, Input, Card)

**Akzeptanzkriterien:**
- Alle Farben/Groessen sind als CSS Custom Properties definiert
- Die App hat ein konsistentes visuelles Grundgeruest
- Layout funktioniert auf Smartphone-Viewports (320px-428px)
- Dark Mode ist Standard
- Kein Inline-Styling oder Magic Numbers

---

### Issue 4: Onboarding: Profil-Eingabe mit Alterscheck

**Labels:** `feature`, `priority: high`, `phase-1`

**Beschreibung:**
Onboarding-Flow implementieren, in dem Nutzer ihre Daten eingeben. Daten werden rein lokal gespeichert (localStorage via Zustand). Alterscheck mit 3-stufiger Logik.

**Aufgaben:**
- Onboarding-Formular: Name/Spitzname, Alter, Gewicht (kg), Geschlecht (m/w/divers), optional Koerpergroesse (cm)
- Validierung aller Felder (sinnvolle Wertebereiche)
- Alterscheck: <16 gesperrt, 16-17 eingeschraenkt, >=18 voll
- Zustand Store mit localStorage-Persistenz (persist middleware)
- Profil-Bearbeitung nachtraeglich moeglich
- Skip-Erkennung: Wenn Profil existiert, direkt zum Hauptmenue

**Akzeptanzkriterien:**
- Nutzer kann alle Pflichtfelder ausfuellen und absenden
- Daten sind nach Reload noch vorhanden (localStorage)
- Alter < 16 wird korrekt gesperrt
- Alter 16-17 zeigt eingeschraenkten Modus
- Formular-Validierung verhindert unsinnige Eingaben
- Profil kann nachtraeglich bearbeitet werden

---

### Issue 5: Drink Catalog: Getraenke-Datenbank + Auswahl-UI

**Labels:** `feature`, `priority: high`, `phase-1`

**Beschreibung:**
Statische Getraenke-Datenbank mit vorkonfigurierten Getraenken (Bier, Wein, Cocktails, Shots, etc.) und UI zur Auswahl des aktuellen Getraenks. Grundlage fuer die individuelle Schluck-Berechnung.

**Aufgaben:**
- DrinkDefinition-Interface definieren (id, name, category, volume, abv, sipSize, alcoholPerSip)
- Vorkonfigurierte Getraenke-Liste: Bier (Pils, Helles, Weissbier), Wein (Weiss, Rot), Sekt, Cocktail (Standard, stark), Longdrink, Shot
- Berechnung: Alkohol pro Schluck = Schluckgroesse * ABV/100 * 0.789
- Custom-Getraenk-Eingabe (Volumen + ABV)
- Mobile-freundliche Auswahl-UI (Kacheln/Cards nach Kategorie)
- Getraenk-Wechsel waehrend des Abends moeglich

**Akzeptanzkriterien:**
- Mindestens 10 vorkonfigurierte Getraenke verfuegbar
- Alkohol pro Schluck wird korrekt berechnet (Unit-Tests)
- Custom-Getraenk kann hinzugefuegt werden
- Ausgewaehltes Getraenk wird in localStorage persistiert
- Getraenk ist jederzeit aenderbar

---

### Issue 6: BAC Engine: Widmark-Formel + Schluck-Berechnung

**Labels:** `feature`, `architecture`, `priority: high`, `phase-1`

**Beschreibung:**
Zentrale Berechnungslogik als framework-unabhaengiges Modul (engine/). Implementiert die Widmark-Formel fuer BAC-Berechnung und die individuelle Schluck-Berechnung basierend auf Spielerprofil + Getraenk.

**Aufgaben:**
- Widmark-Formel implementieren: BAC = (A / (r * W)) - (beta * t)
- Vorwaerts-Berechnung: Konsumierte Menge -> aktueller BAC
- Rueckwaerts-Berechnung: Ziel-BAC -> benoetigte Schluecke (abhaengig vom Getraenk)
- calculateSipsForPlayer()-Funktion: individuelle Schluckzahl pro Spieler
- Zwei-Phasen-Logik: "Pegel erreichen" (BAC < Ziel) vs. "Pegel halten" (BAC >= Ziel)
- Widmark-Faktor r nach Geschlecht (m: 0.68, w: 0.55, divers: 0.615)
- Abbaurate beta = 0.15 Promille/h
- Umfangreiche Unit-Tests mit verschiedenen Koerperdaten und Getraenken

**Akzeptanzkriterien:**
- Vorwaerts-Berechnung liefert plausible BAC-Werte fuer bekannte Szenarien
- Rueckwaerts-Berechnung gibt korrekte Schluckanzahlen aus
- Phase "Pegel erreichen" gibt mehr Schluecke als Phase "Pegel halten"
- Bier-Trinker bekommt mehr Schluecke als Cocktail-Trinker (gleicher Spielzug)
- Mindestens 15 Unit-Tests fuer verschiedene Szenarien
- Modul ist framework-unabhaengig (kein React-Import)

---

### Issue 7: Restalkohol-Rechner: Nuechternzeit + Fahrtuechtigkeits-Check

**Labels:** `feature`, `priority: high`, `phase-1`

**Beschreibung:**
Restalkohol-Berechnung fuer den naechsten Morgen. Zeigt geschaetzte Nuechternzeit und prueft Fahrtuechtigkeits mit Ampel-System.

**Aufgaben:**
- Berechnung: Zeit bis nuechtern = aktueller BAC / Abbaurate (0.15/h)
- "Nuechtern um X Uhr"-Anzeige
- Fahrtuechtigkeits-Check: "Ich muss morgen um X Uhr fahren" -> Prognose
- Ampel-System: Gruen (BAC = 0.0), Gelb (BAC 0.0-0.3), Rot (BAC > 0.3)
- Konservative Logik: Erst bei 0.0 "Gruen" (nicht bei 0.5 Promille-Grenze)
- UI: Klare, uebersichtliche Anzeige mit Farbcodierung
- Hinweis auf relative Fahruntuechtigkeits ab 0.3 Promille

**Akzeptanzkriterien:**
- Nuechternzeit wird korrekt berechnet (Unit-Tests)
- Ampel-System zeigt korrekte Farbe basierend auf geschaetztem BAC zur Zielzeit
- Konservativ: "Gruen" nur bei BAC = 0.0
- Disclaimer ist sichtbar ("Grobe Schaetzung, kein Ersatz fuer Messung")
- UI ist auch um 3 Uhr nachts intuitiv bedienbar

---

### Issue 8: BAC-Anzeige + Trinkempfehlung (Dashboard-Screen)

**Labels:** `feature`, `priority: medium`, `phase-1`

**Beschreibung:**
Hauptscreen nach dem Onboarding: Zeigt den aktuellen geschaetzten BAC, die persoenliche Trinkempfehlung in Schluecken des gewaehlten Getraenks, und den Restalkohol-Status.

**Aufgaben:**
- Dashboard-Layout mit aktuellem BAC (prominent)
- Trinkempfehlung: "Um deinen Ziel-Pegel zu erreichen: X Schluecke [Getraenk]"
- Aktuelles Getraenk anzeigen + Quick-Change-Button
- Zugang zum Restalkohol-Rechner
- Navigation zu Spielauswahl
- Disclaimer-Banner (persistent, nicht wegklickbar beim ersten Mal)

**Akzeptanzkriterien:**
- Dashboard zeigt korrekten BAC basierend auf Profil + Drink-Log
- Trinkempfehlung ist individuell (basierend auf Getraenk + Koerperdaten)
- Disclaimer wird beim ersten Besuch angezeigt und muss akzeptiert werden
- Navigation zu allen Hauptbereichen funktioniert

---

### Issue 9: Disclaimer-System

**Labels:** `feature`, `priority: medium`, `phase-1`

**Beschreibung:**
Rechtlicher Disclaimer, der beim ersten Start und an relevanten Stellen angezeigt wird. Muss von Nutzern akzeptiert werden.

**Aufgaben:**
- Disclaimer-Text formulieren (deutsch, verstaendlich, rechtlich sinnvoll)
- Disclaimer-Modal beim ersten App-Start (muss akzeptiert werden)
- Dezenter Disclaimer-Hinweis auf Screens mit BAC-Anzeige
- Disclaimer-Status in localStorage speichern
- Link zu ausfuehrlichem Disclaimer jederzeit erreichbar

**Akzeptanzkriterien:**
- Disclaimer erscheint beim ersten Start und blockiert die App bis zur Akzeptanz
- Disclaimer-Text kommuniziert klar: keine medizinische Beratung, individuelle Faktoren
- Nach Akzeptanz wird der Disclaimer nicht erneut als Modal gezeigt
- Dezenter Hinweis bleibt auf BAC-relevanten Screens sichtbar

---

### Issue 10: Routing + App-Struktur

**Labels:** `architecture`, `priority: medium`, `phase-1`

**Beschreibung:**
React Router v7 einrichten mit den Hauptrouten der App. Lazy Loading fuer Spiele-Module vorbereiten.

**Aufgaben:**
- React Router v7 installieren und konfigurieren
- Routen definieren: / (Onboarding/Dashboard), /drinks (Getraenke-Auswahl), /games (Spieluebersicht), /game/:id (Spiel), /lobby/:code (Lobby), /residual (Restalkohol)
- Layout-Komponente mit Navigation
- 404-Seite
- Lazy Loading Setup fuer game/:id Routen

**Akzeptanzkriterien:**
- Alle definierten Routen sind erreichbar
- Navigation zwischen Screens funktioniert
- Deep Links funktionieren (z.B. direkt /residual oeffnen)
- Game-Routes sind fuer Lazy Loading vorbereitet

---

## Phase 2: Lobby + erstes Spiel

### Issue 11: Firebase-Integration + Lobby erstellen/beitreten

**Labels:** `feature`, `architecture`, `priority: high`, `phase-2`

**Beschreibung:**
Firebase Realtime Database integrieren. Lobby-System: Spieler koennen eine Lobby erstellen (generiert Code) oder einer bestehenden beitreten.

**Aufgaben:**
- Firebase JS SDK installieren + konfigurieren
- Firebase-Konfiguration in .env (nicht committen)
- Lobby erstellen: Generiert 6-stelligen alphanumerischen Code
- Lobby beitreten: Code eingeben, validieren, joinen
- Spielerliste in Echtzeit synchronisieren
- Host-Konzept: Ersteller ist Host, kann Spiel starten
- Spieler-Austritt / Disconnect-Handling
- TTL fuer inaktive Lobbies (z.B. 2 Stunden)
- Getraenke-Auswahl in der Lobby (jeder Spieler waehlt lokal sein Getraenk)

**Akzeptanzkriterien:**
- Lobby-Code wird generiert und ist eindeutig
- Zweites Geraet kann mit Code beitreten
- Spielerliste aktualisiert sich in Echtzeit auf allen Geraeten
- Nur Host kann Spiel starten
- Verlassene Lobbies werden nach TTL automatisch bereinigt
- Keine persoenlichen Daten (Gewicht, BAC) werden an Firebase gesendet

---

### Issue 12: Game Registry + Plugin-Interface

**Labels:** `architecture`, `priority: high`, `phase-2`

**Beschreibung:**
Spiele-Plugin-System implementieren: Zentrale Registry, GameDefinition-Interface, Lazy Loading. Neues Spiel = 1 Ordner + 1 Zeile in der Registry.

**Aufgaben:**
- GameDefinition-Interface finalisieren (siehe implementation_plan.md)
- DrinkDefinition- und PlayerDrinkState-Interfaces finalisieren
- Zentrale Game Registry (Map<string, GameDefinition>)
- calculateSipsForPlayer() als zentrale Funktion, die alle Spiele nutzen
- Spiel-Auswahl-Screen: Liste aller registrierten Spiele
- Lazy Loading der Spiel-Komponenten
- Shared Hooks/Utilities fuer Spiele (useGameState, useSipCalculation)

**Akzeptanzkriterien:**
- Ein neues Spiel hinzuzufuegen erfordert nur 1 neuen Ordner + 1 Import in der Registry
- Spiel-Auswahl zeigt alle registrierten Spiele mit Metadaten
- GameDefinition-Interface deckt alle Beduerfnisse ab (Metadaten, Komponente, State, Reducer)
- calculateSipsForPlayer() liefert korrekte, individualisierte Schluckzahlen

---

### Issue 13: Erstes Spiel: Wahrheit oder Pflicht

**Labels:** `feature`, `priority: high`, `phase-2`

**Beschreibung:**
Erstes Trinkspiel als Plugin implementieren: "Wahrheit oder Pflicht". Proof-of-Concept fuer das Plugin-System und die individuelle Schluck-Berechnung.

**Aufgaben:**
- GameDefinition fuer "Wahrheit oder Pflicht" erstellen
- Fragen-/Aufgaben-Katalog zusammenstellen (mindestens 50 Wahrheits-Fragen, 50 Pflicht-Aufgaben)
- Spielablauf: Zufaelliger Spieler -> Wahrheit oder Pflicht waehlen -> Frage/Aufgabe anzeigen
- Trinkregel: Bei Verweigerung muss getrunken werden -> individuelle Schluckzahl anzeigen
- Jeder Spieler sieht seine eigene Schluckzahl auf seinem Geraet
- Pegel-Erreichen vs. Pegel-Halten Logik aktiv
- Spielstand-Sync ueber Firebase
- Getraenk-Wechsel waehrend des Spiels moeglich

**Akzeptanzkriterien:**
- Spiel ist ueber die Game Registry registriert und in der Spiel-Auswahl sichtbar
- Mindestens 2 Spieler koennen gleichzeitig auf verschiedenen Geraeten spielen
- Schluckzahlen sind individuell (verschiedene Getraenke -> verschiedene Zahlen)
- Pegel-Halten: Spieler mit BAC >= 0.4 bekommt weniger Schluecke
- Fragen/Aufgaben wiederholen sich nicht zu schnell
- Spielstand synchronisiert in Echtzeit

---

### Issue 14: Echtzeit-Spielstand-Sync

**Labels:** `architecture`, `priority: high`, `phase-2`

**Beschreibung:**
Generisches System fuer die Synchronisierung des Spielstands ueber Firebase. Muss fuer alle Spiele funktionieren (nicht nur Wahrheit/Pflicht).

**Aufgaben:**
- Generische Firebase-Abstraktion fuer Spielstand (CRUD auf /lobbies/{code}/gameState)
- Spielzug-Broadcasts: Eine Aktion wird gesendet, alle Geraete reagieren
- Optimistic Updates fuer schnelles Feedback
- Konflikt-Handling bei gleichzeitigen Aktionen
- Reconnect-Logik bei Verbindungsabbruch
- BAC-Daten werden NICHT synchronisiert (bleiben lokal)

**Akzeptanzkriterien:**
- Spielzuege werden in < 500ms auf allen Geraeten angezeigt
- Verbindungsabbruch wird erkannt und Reconnect versucht
- Nach Reconnect wird der aktuelle Spielstand korrekt geladen
- Keine persoenlichen Gesundheitsdaten in Firebase

---

### Issue 15: Drink-Log + Live-BAC-Tracking waehrend des Spiels

**Labels:** `feature`, `priority: medium`, `phase-2`

**Beschreibung:**
Waehrend eines Spiels wird jeder "Trinke X Schluecke"-Befehl im Drink-Log festgehalten. Der geschaetzte BAC wird laufend aktualisiert und beeinflusst die Schluck-Berechnung.

**Aufgaben:**
- Drink-Log-Store: Zeitstempel + Menge (Schluecke * Alkohol pro Schluck) fuer jedes Trinkereignis
- Laufende BAC-Schaetzung basierend auf Drink-Log + verstrichener Zeit
- Automatischer Phasen-Wechsel: "Pegel erreichen" -> "Pegel halten"
- Dezente BAC-Anzeige waehrend des Spiels (optional ein-/ausblendbar)
- Drink-Log in localStorage persistieren (ueberlebt App-Neustart)
- Getraenk-Wechsel: Log beruecksichtigt verschiedene Getraenke

**Akzeptanzkriterien:**
- Jedes Trinkereignis wird mit Zeitstempel geloggt
- BAC-Schaetzung aktualisiert sich nach jedem Trinkereignis
- Phasen-Wechsel funktioniert automatisch (Schluckzahlen reduzieren sich)
- Drink-Log ueberlebt einen App-Neustart
- Getraenk-Wechsel wird im Log korrekt erfasst

---

## gh CLI Befehle

Falls `gh` installiert ist, koennen alle Issues automatisch erstellt werden. Zuerst Labels anlegen, dann Issues:

```bash
# Labels erstellen (einmalig)
gh label create "phase-1" --repo PaulWeber-co/Scientific-Drinking-Game --color "0E8A16" --description "Phase 1: Foundation & Onboarding"
gh label create "phase-2" --repo PaulWeber-co/Scientific-Drinking-Game --color "1D76DB" --description "Phase 2: Lobby & erstes Spiel"
gh label create "priority: high" --repo PaulWeber-co/Scientific-Drinking-Game --color "B60205" --description "Hohe Prioritaet"
gh label create "priority: medium" --repo PaulWeber-co/Scientific-Drinking-Game --color "FBCA04" --description "Mittlere Prioritaet"
gh label create "setup" --repo PaulWeber-co/Scientific-Drinking-Game --color "C5DEF5" --description "Projekt-Setup & Tooling"
gh label create "feature" --repo PaulWeber-co/Scientific-Drinking-Game --color "A2EEEF" --description "Neues Feature"
gh label create "architecture" --repo PaulWeber-co/Scientific-Drinking-Game --color "D4C5F9" --description "Architektur & Infrastruktur"
gh label create "design" --repo PaulWeber-co/Scientific-Drinking-Game --color "F9D0C4" --description "Design & Styling"
```

```bash
# Phase 1 Issues
gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "Projekt-Setup: Vite + React + TypeScript initialisieren" -l "setup,priority: high,phase-1" -b "Vite + React 19 + TypeScript Projekt aufsetzen. ESLint, Prettier, Vitest konfigurieren. package.json Scripts definieren."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "CI/CD: GitHub Actions Pipeline + Deployment auf GitHub Pages" -l "setup,priority: high,phase-1" -b "GitHub Actions Workflow fuer automatisches Deployment auf GitHub Pages. Lint + Test als CI-Checks."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "Design-System: CSS Custom Properties + Mobile-first Basis-Layout" -l "design,priority: high,phase-1" -b "CSS Custom Properties, Google Font, Dark Mode als Standard, Mobile-first Layout, grundlegende UI-Komponenten."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "Onboarding: Profil-Eingabe mit Alterscheck" -l "feature,priority: high,phase-1" -b "Onboarding-Formular (Name, Alter, Gewicht, Geschlecht). 3-stufiger Alterscheck (<16 gesperrt, 16-17 eingeschraenkt, >=18 voll). localStorage via Zustand."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "Drink Catalog: Getraenke-Datenbank + Auswahl-UI" -l "feature,priority: high,phase-1" -b "10+ vorkonfigurierte Getraenke (Bier, Wein, Cocktails, Shots). Alkohol pro Schluck berechnen. Custom-Getraenk-Eingabe. Mobile-freundliche Auswahl-UI."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "BAC Engine: Widmark-Formel + Schluck-Berechnung" -l "feature,architecture,priority: high,phase-1" -b "Widmark-Formel, Vorwaerts- und Rueckwaerts-Berechnung, calculateSipsForPlayer(), Zwei-Phasen-Logik (Pegel erreichen/halten). 15+ Unit-Tests."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "Restalkohol-Rechner: Nuechternzeit + Fahrtuechtigkeits-Check" -l "feature,priority: high,phase-1" -b "Nuechtern-um-Anzeige, Fahrtuechtigkeits-Check mit Zielzeit, Ampel-System (Gruen nur bei 0.0 BAC). Konservative Logik."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "BAC-Anzeige + Trinkempfehlung (Dashboard-Screen)" -l "feature,priority: medium,phase-1" -b "Hauptscreen mit BAC, individueller Trinkempfehlung in Schluecken, Quick-Change fuer Getraenk, Navigation."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "Disclaimer-System" -l "feature,priority: medium,phase-1" -b "Disclaimer-Modal beim ersten Start, dezenter Hinweis auf BAC-Screens, Status in localStorage."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "Routing + App-Struktur" -l "architecture,priority: medium,phase-1" -b "React Router v7 mit Routen: /, /drinks, /games, /game/:id, /lobby/:code, /residual. Lazy Loading fuer Games."

# Phase 2 Issues
gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "Firebase-Integration + Lobby erstellen/beitreten" -l "feature,architecture,priority: high,phase-2" -b "Firebase SDK, Lobby mit 6-stelligem Code, Echtzeit-Spielerliste, Host-Konzept, TTL, keine persoenlichen Daten an Firebase."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "Game Registry + Plugin-Interface" -l "architecture,priority: high,phase-2" -b "GameDefinition + DrinkDefinition Interfaces, zentrale Registry, calculateSipsForPlayer(), Lazy Loading, Spiel-Auswahl-Screen."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "Erstes Spiel: Wahrheit oder Pflicht" -l "feature,priority: high,phase-2" -b "50+ Fragen/Aufgaben, individuelle Schluckzahlen pro Spieler, Pegel-Logik, Echtzeit-Sync. Proof-of-Concept fuer Plugin-System."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "Echtzeit-Spielstand-Sync" -l "architecture,priority: high,phase-2" -b "Generische Firebase-Abstraktion, Spielzug-Broadcasts, Optimistic Updates, Reconnect-Logik. Keine Gesundheitsdaten in Firebase."

gh issue create -R PaulWeber-co/Scientific-Drinking-Game -t "Drink-Log + Live-BAC-Tracking waehrend des Spiels" -l "feature,priority: medium,phase-2" -b "Drink-Log mit Zeitstempeln, laufende BAC-Schaetzung, automatischer Phasen-Wechsel, Getraenk-Wechsel im Log."
```
