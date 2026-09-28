# Meme-Duell

Das Meme-Duell spielt sich wie die bekannten Online-Meme-Partyspiele: Jede Person bekommt eine
Meme-Vorlage, schreibt ihre Texte hinein, danach wird Meme für Meme anonym abgestimmt.
Umgesetzt ist es mit eigenen Namen, eigenem Design (Polaroid-Abzüge wie im Rest der App),
eigenen deutschen Themen und Trinkregeln.

---

## 1. So spielt es sich

| Phase | Was passiert |
|:--|:--|
| **Einrichten** | Der Host wählt Modus, Bastelzeit (45/60/90/120 s), Runden (3/5/8/ohne Ende), Würfe (aus/3/5/8) und ob es das Trittbrett gibt. Alle sehen die Einstellung live. |
| **Basteln** | Jede Person bekommt eine Vorlage im Polaroid, die Textfelder sitzen direkt im Bild und zeigen „Text 1", „Text 2", solange sie leer sind. Tippen aufs Feld im Bild springt ins passende Eingabefeld. Die Schrift passt sich dem Feld an, und jedes Feld nimmt nur so viel Text, wie lesbar hineinpasst (winzige Schilder rund 15 Zeichen, große Felder bis 90). **Neu würfeln** (Standard fünfmal pro Partie) und **Zurück** zur vorigen Vorlage, das kostet keinen Wurf, der Text bleibt erhalten. „Fertig" lässt sich bis zum Ablauf der Uhr zurücknehmen. Läuft die Uhr ab, schickt das Handy ab, was getippt ist. Keine Vorlage kommt in einer Partie zweimal. |
| **Abstimmen** | Die Memes kommen einzeln, anonym und auf allen Handys gleichzeitig. Jedes „entwickelt" sich wie ein Sofortbild. Drei Knöpfe: **Fire** (+), **OK** (0), **Lame** (−). Dazu vier **Reaktionen** (Lachen, Tot gelacht, Liebe, Cringe), die anonym auf allen Handys übers Bild fliegen, und oben rechts **Speichern**. Wer das Meme gebaut hat, sieht „Pokerface" und keine Abstimmknöpfe, spürt aber jede Reaktion als kurzes Tippen. |
| **Auflösung** | Das Meme der Runde groß mit goldenem Prägeetikett, darunter der Rest des Stapels mit Namen, Punkten und Stimmen. Antippen zeigt ein Meme groß, dort lässt es sich speichern. Dann Punktestand (Meme, Trittbrett, Mitfahrer) und Trinkansagen. |
| **Finale** | Podest für die ersten drei, Endstand mit Aufschlüsselung der Punkte, Trinkansage, und ganz unten **„Von Fire bis Lame"**: jedes Meme der Partie vom besten zum schwächsten. Antippen zeigt es groß und speichert es als Bild. |

### Punkte

- Einstimmig **Fire = +1000**. Jedes Lame zieht im selben Maß ab, OK zählt null.
  Formel: `1000 × (hoch − runter) / Abstimmende`. Ein Meme kann ins Minus rutschen.
- **Trittbrett:** Einmal pro Runde springst du auf ein fremdes Meme auf, **während** es gezeigt
  wird, und bekommst die Hälfte seiner Punkte, auch die Hälfte eines Minus.
- **Mitfahrer-Bonus:** Das Meme bekommt **+10 je Person**, die darauf mitfährt.
- Wer nicht abstimmt, zählt wie OK.

### Modi

| Modus | Unterschied |
|:--|:--|
| Klassisch | Jede Person zieht ihre eigene Vorlage. |
| Gleiches Meme | Alle bekommen dieselbe Vorlage, kein Würfeln. Nur die Pointe entscheidet. |
| Themen | Jede Runde ein Thema als Zettel über dem Bild („Der Kater morgen früh"). **Eigene Karten** aus dem Spieldetail werden hier zu Themen, Spicy-Themen kommen mit dem Spicy-Schalter dazu. |
| Entspannt | Keine Punkte, kein Trittbrett, keine Trinkansagen, nur Memes und „Von Fire bis Lame". |

### Wer trinkt

| Ansage | Härte (`baseSips`) |
|:--|:--|
| Schwächstes Meme der Runde (nur wenn es einen Unterschied gibt) | 3, bei Minuspunkten 4 |
| Kein Meme abgegeben | 2 |
| Aufs Trittbrett eines Minus-Memes gesprungen | 1 |
| Letzter Platz im Finale | 4 |

Wie immer meldet das Spiel nur die Härte. Die Schluckzahl rechnet jedes Handy selbst aus
den eigenen Körperdaten.

---

## 2. Geht das überhaupt? Wo liegen die Memes?

**Ja, und die Bilder gehören nicht in die Datenbank.**

Die 308 Vorlagen liegen als WebP-Dateien **neben der App** in `public/memes/` (zusammen rund
5,3 MB, im Schnitt 17 KB je Bild). GitHub Pages liefert sie aus wie jede andere Datei, in der
nativen App stecken sie direkt im Paket. Über Firebase geht pro Meme nur das hier:

```json
{ "t": "drake", "x": ["Früh ins Bett", "Noch ein Meme-Duell"] }
```

Das sind etwa 60 Byte statt 17 KB. Die Vorlagen-ID reist statt eines Listenplatzes, damit eine
neue Vorlage auf einem Handy mit neuerer App nicht auf allen anderen ein falsches Bild zeigt.

### Warum nicht in Firebase?

| Möglichkeit | Warum nicht |
|:--|:--|
| Bilder als Base64 in der Realtime Database | Die kostenlose Stufe erlaubt 10 GB Download im Monat. Jeder Lobby-Beitritt zöge die Bilder mit, und weil der Spielstand bei jeder Aktion neu verschickt wird, wäre das Kontingent nach wenigen hundert Partien leer. |
| Cloud Storage for Firebase | Braucht seit dem 3. Februar 2026 den Blaze-Tarif (Kreditkarte), auch für den Standard-Bucket. |
| Statisch mit der App (so gebaut) | Kostet nichts, funktioniert offline, lädt über das CDN von GitHub. Firebase bleibt bei ein paar KB je Spielzug. |

### Was die Datenbank pro Partie aushält

Gemessen mit acht Leuten und fünf Runden (jede Person würfelt einmal pro Runde, alle stimmen
über alles ab): Der Spielstand ist im Schnitt 5,5 KB groß, am Ende knapp 10 KB, weil alle
Memes der Partie fürs Finale mitreisen. Es gibt rund 400 Schreibvorgänge, und jeder geht an
acht Geräte. Das sind etwa **18 MB** Download je Partie, mit zwei Reaktionen je Meme etwa
**22 MB**. Das kostenlose Kontingent von 10 GB/Monat reicht damit für rund 450–550 Partien im
Monat, dazu kommen alle anderen Spiele. Engpass bleibt wie bisher die Grenze von 100
gleichzeitigen Verbindungen (siehe `docs/FIREBASE-VS-SUPABASE.md`).

Damit das so bleibt, trägt der Spielstand nur die nächsten 24 gemischten Vorlagen statt aller
308 (gut 3 KB weniger bei jedem Zug), Reaktionen sind auf die letzten acht begrenzt und pro
Handy höchstens eine alle 0,6 s.

### Offline und Ladezeit

- **Service Worker:** eigener Cache `memes` (260 Einträge, 90 Tage), damit die Vorlagen nicht
  die Kachelmotive verdrängen. Wer eine Vorlage einmal gesehen hat, hat sie auch ohne Netz.
- **Vorladen:** Sobald eine Runde startet, lädt jedes Handy alle Vorlagen dieser Runde. Beim
  Abstimmen steht jedes Meme sofort da.
- Die Vorlagen stehen **nicht** im Precache. 5 MB beim ersten App-Start braucht niemand, der
  nur Busfahrer spielen will.

---

## 3. Aufbau im Code

```
src/games/meme-battle/          (ID bleibt meme-battle, siehe unten)
  meta.ts          Name „Meme-Duell", Regeln, Tags – bleibt im Haupt-Bundle
  game.ts          Zustand und Reducer, reine Logik ohne React
  templates.json   Katalog: ID, Name, Maße, Textfelder (erzeugt vom Import-Skript)
  templates.ts     Typen, templateOf(), memeUrl()
  topics.ts        Themen für den Themen-Modus (inkl. Spicy)
  Meme.tsx         Vorlage + Texte als DOM, Schrift passt sich dem Feld an; Abzug, Prägeetikett
  Editor.tsx       Basteln
  Vote.tsx         Abstimmen, Trittbrett
  Results.tsx      Auflösung einer Runde
  Finale.tsx       Podest, Endstand, „Von Fire bis Lame"
  Lightbox.tsx     Ein Meme groß ansehen und speichern
  Reactions.tsx    Reaktionen: Knöpfe und die fliegenden Symbole
  parts.tsx        Uhr, Themenzettel, Stimmen, hochzählende Punkte, Speichern-Knopf
  Setup.tsx        Einrichten
  render.ts        Brennt ein Meme als JPEG mit Papierrand (Speichern/Teilen)
  meme.css         Alles Optische, auf Basis von .abzug
public/memes/      Die Bilder
scripts/memes/import_memegen.py   Holt und verkleinert die Vorlagen
scripts/memes/extra.json          Textfelder für die Vorlagen ohne eigene Angaben
scripts/meme-preview/             Vorschau mit drei Handys, ohne Lobby
```

Die Spiel-ID bleibt `meme-battle`. An ihr hängen Rundenzahl, Spicy-Schalter, eigene Karten
und das Gedächtnis gesehener Karten auf allen Geräten. Umbenannt ist nur der angezeigte Name.

**Uhren:** Fristen setzt und prüft der Host (`Date.now()` im Reducer). Schläft das Handy des
Hosts, springen die anderen nach 4 s ein. Jede „weiter"-Meldung trägt die Kennung des Memes,
für das sie gedacht war, so springt die Runde auch bei zwei gleichzeitigen Meldungen nur um
eins. Wiederholt wird höchstens alle 1 s (Host) bzw. 3 s (Gäste), damit die Inbox bei
schlafendem Host nicht vollläuft.

**Text im Bild:** `MemeText` sucht per Binärsuche die größte Schriftgröße, bei der der Text ins
Feld passt (Umbruch nur an Wortgrenzen), und misst nach dem Laden der Schrift neu. Die
Exportfunktion in `render.ts` macht dasselbe auf dem Canvas.

---

## 4. Anleitung: Was du tun musst

### Pflicht: nichts Zusätzliches

1. Pull Request mergen. Der Deploy nach GitHub Pages kopiert `public/memes/` automatisch mit.
2. Die Firebase Security Rules bleiben, wie sie sind. `game` nimmt jeden Spielstand an.
3. **Native App (Capacitor):** Nach dem Merge einmal `npm run build && npx cap sync`, damit
   die Bilder im App-Paket landen. Sonst fehlen sie in der iOS/Android-Fassung.

### Allein ausprobieren

```bash
npx vite
# dann im Browser:
http://localhost:5173/Scientific-Drinking-Game/scripts/meme-preview/
```

Drei Handys nebeneinander, gemeinsamer Spielstand. Knöpfe oben: „Bots basteln", „Bots stimmen
ab", „Uhr vorspulen". `?phones=1` zeigt nur ein Handy.

### Vorlagen ergänzen oder entfernen

Das Import-Skript ist wiederholbar. Die 308 Vorlagen kommen aus vier offenen Sammlungen:

| Quelle | Vorlagen | Textfelder |
|:--|--:|:--|
| [memegen](https://github.com/jacebrowning/memegen) | 209 | aus deren `config.yml` (Position, Drehung, Farbe) |
| [ImgFlip575K](https://github.com/schesa/ImgFlip575K_Dataset), die meistgenutzten von imgflip | 44 | von Hand in `scripts/memes/extra.json` |
| [memebank](https://github.com/cipherdragon/memebank) | 16 | von Hand in `extra.json` |
| [MemeTastic](https://github.com/gsantner/memetastic) | 39 | von Hand in `extra.json` |

Gibt es eine Vorlage in mehreren Quellen, gewinnt memegen (dort sind die Felder genauer).

```bash
pip install pillow pyyaml
git clone --depth 1 https://github.com/jacebrowning/memegen /tmp/memegen
git clone --depth 1 https://github.com/cipherdragon/memebank /tmp/memebank
git clone --depth 1 https://github.com/gsantner/memetastic /tmp/memetastic
git clone --depth 1 https://github.com/schesa/ImgFlip575K_Dataset /tmp/imgflip

python3 scripts/memes/import_memegen.py /tmp/memegen/templates \
  --src imgflip575k=/tmp/imgflip/dataset/templates/img \
  --src memebank=/tmp/memebank \
  --src memetastic=/tmp/memetastic/app/src/main/assets/bundled
```

**Inhaltlich wird nichts aussortiert.** Auch schwarzer Humor, Politiker und derbe Vorlagen
sind drin. Nur fünf kommen erst mit dem **Spicy-Schalter** (ab 18) in den Stapel, weil die App
auch Leute unter 18 hat: Elmo (Kokain), Y'all Got Any More (Crack), Dating Site Murderer,
FMR (vulgärer Titel) und Middle Finger. Die Liste steht in `SPICY` im Skript bzw. als
`"spicy": true` in `extra.json`. Soll eine davon immer dabei sein, dort austragen.

**Eine Vorlage entfernen** (etwa auf Hinweis eines Rechteinhabers): ihre ID mit Grund in
`REMOVED` im Skript eintragen und das Skript neu laufen lassen. Nur die Datei zu löschen
reicht nicht, der Katalog zeigte dann ins Leere.

**Textfelder einer Vorlage aus `extra.json` korrigieren:** `boxes` ist eine Liste aus
`[x, y, Breite, Höhe, Stil]`, alles Anteile des Bildes. `"tb"` steht für oben und unten,
`"t"`/`"b"` für nur oben/unten. Stil: ohne Angabe dicke weiße Meme-Schrift, `ink` schwarz und
schlicht (weiße Flächen), `comic` schwarz handschriftlich (Sprechblasen), `thinw` weiß und
schlicht.

**Eigene Vorlagen** (z. B. aus eurem Freundeskreis, mit Einverständnis der Abgebildeten):

```
meine-vorlagen/
  wg-kueche/
    default.jpg
    config.yml
```

```yaml
name: WG-Küche am Sonntag
text:
  - anchor_x: 0.0     # linke obere Ecke des Feldes, Anteil der Bildbreite
    anchor_y: 0.0
    scale_x: 1.0      # Breite des Feldes, Anteil der Bildbreite
    scale_y: 0.2      # Höhe, Anteil der Bildhöhe
  - anchor_x: 0.0
    anchor_y: 0.8
    scale_x: 1.0
    scale_y: 0.2
    color: black      # optional: black, khaki, #RRGGBB …
    font: thin        # optional: thin (schlicht) oder comic; Standard ist die dicke Meme-Schrift
    style: none       # optional: so, wie getippt; Standard ist GROSSBUCHSTABEN
    angle: 8          # optional: Drehung in Grad, gegen den Uhrzeigersinn
```

```bash
python3 scripts/memes/import_memegen.py /tmp/memegen/templates meine-vorlagen \
  --src imgflip575k=/tmp/imgflip/dataset/templates/img \
  --src memebank=/tmp/memebank \
  --src memetastic=/tmp/memetastic/app/src/main/assets/bundled
```

Die `--src`-Angaben immer mitgeben: Das Skript baut den Katalog jedes Mal komplett neu, ohne
sie fielen die 99 Vorlagen aus `extra.json` heraus.

Die Positionen findest du am schnellsten, indem du das Bild in einem Grafikprogramm öffnest
und Pixel durch Bildbreite/-höhe teilst. Danach mit der Vorschau prüfen.

### Nach dem Import prüfen

```bash
npm test -- meme-battle   # prüft u. a., dass kein Feld aus dem Bild ragt
```

---

## 5. Rechtliches

Kein Rechtsrat, sondern der Stand der Recherche. Vor einem kommerziellen Start lohnt eine
Stunde Fachberatung.

### Was von „Make It Meme" bewusst nicht übernommen ist

Spielmechaniken sind als Idee nicht urheberrechtlich geschützt, Namen, Texte, Grafiken und
Gestaltung schon. Deshalb:

| Dort | Hier |
|:--|:--|
| Name „Make it Meme" (Marke) | **Meme-Duell**, der Name taucht nirgends in der App auf |
| „Meme-Buddy" und dessen Punkte | **Trittbrett** und **Mitfahrer-Bonus**, mit Bus-Symbol aus dem eigenen Icon-Set |
| Hoch/Runter-Knöpfe in deren Farben | **Fire / OK / Lame** mit eigenen Symbolen |
| Emoji-Reaktionen | vier eigene SVG-Symbole (die App verwendet bewusst keine Emojis) |
| „Change meme" / „Go back" gegen Münzen | **Neu würfeln** und **Zurück**, ohne Münzen oder Konto |
| „From dank to stank" | **Von Fire bis Lame** |
| Chat, Münzen, Ränge, Konten | nicht nötig: alle sitzen im selben Raum |
| Deren Oberfläche und Grafiken | Polaroid-Abzüge, Klebeband-Zettel, Prägeetiketten aus dem Design der App |
| Englische Themen | eigene deutsche Themen, eigene Spicy-Themen |
| Nur Punkte | Trinkregeln, Pegel-Rechnung, Einwegkamera-Optik beim Speichern |

**Im App-Store-Eintrag und in der Werbung** nicht mit „wie Make It Meme" werben. Ein
Vergleich mit einer fremden Marke ist das, was Ärger bringt, nicht die Spielidee.

### Die Bilder selbst

Die meisten Vorlagen sind Standbilder aus Filmen, Serien und Fotos, deren Rechte bei
Dritten liegen. Das Repository memegen stellt nur den **Code** unter MIT-Lizenz, nicht die
Bilder. Alle großen Meme-Seiten arbeiten mit genau diesen Vorlagen. Ein Restrisiko bleibt
trotzdem:

- **§ 51a UrhG (Karikatur, Parodie, Pastiche):** Der EuGH hat am 14.04.2026 („Pelham II",
  C-590/23) festgelegt, dass ein Pastiche an ein Werk erinnern, erkennbar davon abweichen und
  in einen erkennbaren Dialog mit ihm treten muss. Ein **fertiges Meme** mit eigenem Text
  passt gut in dieses Raster. Die **leere Vorlage**, die die App mitliefert, ist dagegen
  zunächst eine Vervielfältigung. Genau dort liegt die Grauzone.
- **Persönlichkeitsrecht:** Einige Vorlagen zeigen reale Personen, darunter Politiker und
  Privatpersonen, die unfreiwillig zum Meme wurden (etwa „Third World Kid", „Redneck",
  „Dating Site Murderer"). Auf Wunsch ist inhaltlich **nichts ausgeschlossen**. Das erhöht das
  Risiko einer Beschwerde etwas, vor allem bei Privatpersonen. Der Entfernen-auf-Hinweis-Weg
  unten fängt das auf.

**Was das Risiko praktisch klein hält:**

1. Eine Kontaktadresse im Impressum (`src/legal/site.ts`) und die Zusage, Vorlagen auf Hinweis
   **sofort** zu entfernen (Eintrag in `REMOVED`, Skript laufen lassen, deployen).
2. Die Quelle je Vorlage steht im Katalog (`src` → meist Know Your Meme oder die Sammlung, aus
   der sie stammt). So lässt sich jede Anfrage schnell zuordnen.
3. **App Store / Play Store:** Apple (Richtlinie 5.2) und Google prüfen fremdes geistiges
   Eigentum strenger als das Web. Wird die native App abgelehnt, ist der schnellste Weg eine
   Store-Fassung mit eigenen Vorlagen (eigene Fotos, CC0-Bilder), gleiches Skript mit einem
   anderen Ordner.

### Datenschutz

Keine neue Datenkategorie: Wie vorher gehen Spielstand und getippte Texte über die Lobby
(steht in der Datenschutzerklärung unter „Spielstand des laufenden Spiels"). Bilder verlassen
das Gerät nur, wenn jemand ausdrücklich auf „Speichern" tippt, und dann ins Teilen-Menü des
Systems, nicht auf einen Server.
