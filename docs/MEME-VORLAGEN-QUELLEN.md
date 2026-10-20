# Neuere Meme-Vorlagen: Quellen und Prüfung

Stand: **19. Oktober 2026**. Der Katalog enthält jetzt **320 Vorlagen**, davon **12 neue Bildvorlagen** mit belegter Verbreitung 2024–2026. Zwei davon sind unterschiedliche Moo-Deng-Reaktionen. Die bisherigen 308 Einträge und Bilddateien wurden nicht ersetzt.

„Neuer“ bedeutet hier ein neueres oder erneut populäres Meme-Format. Es bedeutet nicht, dass jede Aufnahme, Zeichnung oder Bildmontage erst in diesem Zeitraum entstanden ist. Es gibt keine Behauptung, diese Auswahl bilde alle aktuellen Trends ab.

## Auswahl und Datierung

| Vorlage / lokale ID | Belegte Verwendung | Beleg |
| :--- | :--- | :--- |
| Absolute Cinema / `absolute-cinema-blank` | 2024 populäres Reaktionsformat; das Scorsese-Foto stammt aus einem Interview von 2020. | [KYM-Jahresrückblick 2024](https://knowyourmeme.com/editorials/poll/kym-review-the-top-20-memes-of-2024), [Herkunftserklärung](https://trending.knowyourmeme.com/editorials/guides/what-is-the-absolute-cinema-meme-martin-scorseses-this-is-cinema-memes-and-origin-explained) |
| Sad Hamster / `sad-hamster` | Das Format mit trauriger Musik wurde im Februar 2024 viral. | [KYM-Erklärung vom Februar 2024](https://trending.knowyourmeme.com/editorials/guides/what-is-the-hamster-with-big-eyes-or-sad-hamster-meme-the-viral-format-appearing-on-tiktok-with-sad-violin-music-explained/) |
| Symphony Dolphin / `happy-dolphin-rainbow` | Die Kombination aus buntem Delfinbild und gegensätzlicher Aussage verbreitete sich im August 2024. Die Illustration ist älter. | [Rainbow Dolphin / Symphony Dolphin](https://knowyourmeme.com/memes/rainbow-dolphin-symphony-dolphin) |
| Bro Visited His Friend / `bro-visited-his-friend` | Comic von Fallenchungus vom März 2024; Verbreitung im April 2024. | [Comic und Verbreitung](https://knowyourmeme.com/memes/bro-visited-his-friend-friendpilled-visitmaxxer) |
| What Kind of American? / `what-kind-of-american` | Bildformat zum Filmstart im April 2024; die Szene war bereits im Trailer von Dezember 2023 zu sehen. | [Entwicklung des Formats](https://knowyourmeme.com/memes/what-kind-of-american-are-you) |
| Chill Guy / `chill-guy` | Figur von Phillip Banks aus 2023; virale Schübe im September und November 2024. | [Figur und Trend](https://knowyourmeme.com/memes/just-a-chill-guy-my-new-character) |
| Moo Deng / `moo-deng` und `moo-deng-side-eye` | Zwei Reaktionen aus dem Tiermotiv, das im September 2024 viral wurde. | [Moo-Deng-Dokumentation und ursprüngliche Zoo-Posts](https://knowyourmeme.com/memes/moo-deng-the-baby-hippo) |
| 100 Men vs. 1 Gorilla / `100-men-vs-1-gorilla` | Die Debatte erlebte im April/Mai 2025 einen viralen Schub; das Gedankenspiel ist älter. | [Dokumentation der Debatte](https://knowyourmeme.com/memes/100-men-vs-1-gorilla) |
| Meowl / `meowl` | Die Katze-Eule-Montage stammt aus 2013, der „New Soul“-Trend aus August/September 2025. | [Meowl und erneute Verbreitung](https://knowyourmeme.com/memes/meowl) |
| Jon Hamm Dancing / `jon-hamm-dancing` | „Turn the Lights Off“-Trend von Oktober bis Dezember 2025. In der App ein Standbild aus dem tatsächlichen Clip. | [Dokumentation des Trends](https://knowyourmeme.com/memes/jon-hamm-dancing-in-the-club-scene-turn-the-lights-off-trend) |
| High vs. Low Cortisol / `high-vs-low-cortisol` | Verwendung als Kontrastformat ist 2026 belegt. Das Entstehungsjahr wird hier ausdrücklich nicht festgelegt. | [SUARA USU vom 22. Mai 2026](https://suarausu.or.id/meme-high-low-cortisol-cara-gen-z-berekspresi/), [datierte CapCut-Vorlage vom März 2026](https://www.capcut.com/template-detail/High-low-cortisol/7612076633742249232) |

## Bilddateien und Textfelder

Die tatsächlichen Originaldateien kommen aus zwei öffentlichen Sammlungen:

- [tenequm/memegen-rs, festgelegter Commit `852bd131…`](https://github.com/tenequm/memegen-rs/tree/852bd13168961b34300a2d0712cea4cf863f07d7/templates): Absolute Cinema, Sad Hamster, Symphony Dolphin, Bro Visited His Friend, What Kind of American und High/Low Cortisol. Textfelder basieren auf den jeweiligen `config.yml`-Dateien.
- [kartikkabadi/meme-maker, festgelegter Commit `0e8531e6…`](https://github.com/kartikkabadi/meme-maker/tree/0e8531e680951612f4bb1437ef767ea5f7ce8519/assets/templates): Chill Guy, beide Moo-Deng-Reaktionen, 100 Men vs. 1 Gorilla, Meowl und Jon Hamm Dancing. Textfelder basieren auf den Slots im dortigen Vorlagenmanifest.

Die Bilddateien wurden einzeln angesehen. Irreführende Bild/Name-Paare aus der ersten Sammlung wurden verworfen: Beispielsweise enthielt deren Ordner `john-hamm-dancing` tatsächlich ein Harry-Potter-Bild. Für Jon Hamm wurde deshalb das passende GIF aus der zweiten Sammlung verwendet. Es wurden keine bekannten Memes mit Bildgenerierung nachgebaut.

Die Sprechblasen von **Bro Visited His Friend** lagen in der Quellkonfiguration teilweise über den Gesichtern. Ihre Positionen wurden für das tatsächlich gelieferte Bild korrigiert. **High/Low Cortisol** hat zwei dunkle Beschriftungen im freien oberen Bereich über den Anzeigen. **Jon Hamm** hat zwei schmale Beschriftungsbereiche, die sein Gesicht freihalten. Die übrigen Bilder verwenden passende obere und untere Textbereiche. Die Vorlagen enthalten keine vorgegebenen Witz-Beschriftungen; im Comic bleibt der zum Format gehörende kurze chinesische Ausdruck sichtbar.

Die App lädt ausschließlich lokale `public/memes/<id>.webp`-Dateien; zum Spielen wird keine dieser Websites aufgerufen. Wie im bisherigen Import werden Bilder auf höchstens 720 Pixel an der langen Kante verkleinert und als WebP mit Qualität 74 gespeichert. GIFs werden grundsätzlich zum Standbild aus dem ersten Drittel. Bei Jon Hamm ist im Manifest stattdessen Bild 0 festgelegt, weil sein Gesicht dort deutlich besser erkennbar ist. Der kleine Jon-Hamm-Clip bleibt bei seinen ursprünglichen 320 × 214 Pixeln; er wird nicht künstlich hochskaliert.

## Reproduzierbarer Import

[scripts/memes/recent.json](../scripts/memes/recent.json) enthält für jede Ergänzung den festen Bildlink, die SHA-256-Prüfsumme der Originaldatei, den Herkunftslink des Quellkatalogs, den Aktualitätsbeleg und die Textfelder. Der zusätzliche Import verändert keine anders belegte ID und löscht keine vorhandenen Bilder:

```sh
python3 scripts/memes/import_recent.py
```

Für einen bereits heruntergeladenen Satz Originale:

```sh
python3 scripts/memes/import_recent.py --cache /tmp/pegel-recent-memes
```

Nach einem vollständigen Neuimport mit `import_memegen.py` diesen Zusatzimport erneut ausführen. Er benötigt Pillow und dieselben erlaubten GitHub-Verbindungen wie der bisherige Import. Imgflip ist nur als Herkunftslink dokumentiert und wird nicht für Downloads verwendet.

## Rechteangaben

Die MIT-Lizenzen der Sammlungsprogramme sind **keine pauschale Lizenz für die abgebildeten Fotos, Figuren, Filmaufnahmen oder Zeichnungen**. Die zweite Sammlung bezeichnet ihre Bilder als „fair-use“; diese Einordnung wird hier als Quellangabe dokumentiert und nicht in eine freie Bildlizenz umgedeutet. Die Bilder behalten ihre jeweiligen Urheberrechte. Herkunftslinks und Prüfsummen dokumentieren Provenienz, sie ersetzen keine Nutzungserlaubnis.

Bei Chill Guy ist Phillip Banks als Urheber bekannt; [seine öffentlich berichteten Einwände gegen kommerzielle Markennutzung](https://knowyourmeme.com/news/the-chill-guy-meme-has-been-copyrighted-by-creator-phillip-banks-who-says-hes-dmca-striking-brands-using-it-for-profit) sind vor einer entsprechenden Veröffentlichung zu berücksichtigen. Diese Ergänzung macht ebenso wenig wie der bestehende Meme-Katalog eine Aussage über eine geklärte kommerzielle Bildlizenz.

## Verifikation

Geprüft wurden die vollständig dekodierbaren WebP-Dateien, Übereinstimmung der Pixelmaße mit dem Katalog, eindeutige IDs, zu jeder ID vorhandene Bilddateien, Textfelder innerhalb der Bildgrenzen, die Prüfsummen der Quellen und ein zweiter idempotenter Import. Die bisherigen Einträge und ihre Bilddateien werden zusätzlich gegen den Git-Ausgangsstand verglichen. Die bestehende Meme-Duell-Suite prüft die Katalog- und Textfeldregeln.
