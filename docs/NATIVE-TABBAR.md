# Native iOS-Tab-Leiste für den TestFlight-Build

## To-do im bestehenden Xcode-Projekt

Das iOS-Projekt und seine Build-Action sind hier nicht eingecheckt. Bundle-ID, Signierung, App-Store-Eintrag und vorhandene Controller bleiben im bestehenden Projekt. Diese Dateien bereiten eine Capacitor-Integration vor; der Swift-Code ist unter Linux **nicht kompiliert oder auf einem iPhone geprüft**.

1. `native/ios/NativeTabsPlugin.swift` in die App-Gruppe des Xcode-Projekts kopieren und unter **Target Membership** dem App-Target zuordnen.
2. Das Plugin im bestehenden `CAPBridgeViewController` registrieren. Gibt es noch keine eigene Unterklasse, eine anlegen und in `Main.storyboard` als Custom Class des Bridge View Controllers eintragen. Keine zweite Bridge/WebView erzeugen. Beispiel für ein Projekt ohne eigene Unterklasse:

   ```swift
   import UIKit
   import Capacitor

   class MyViewController: CAPBridgeViewController {
       private let nativeTabs = NativeTabsPlugin()

       override func capacitorDidLoad() {
           super.capacitorDidLoad()
           bridge?.registerPluginInstance(nativeTabs)
       }

       override func viewDidLayoutSubviews() {
           super.viewDidLayoutSubviews()
           nativeTabs.updateLayout()
       }
   }
   ```

   Bei einem bereits angepassten Controller diese Zeilen integrieren und vorhandene Plugin-Registrierungen und Layout-Anpassungen beibehalten. Der Layout-Aufruf aktualisiert die explizite Tab-Bar-Höhe aus `UITabBar.sizeThatFits`, auch nach Rotation oder Safe-Area-Änderungen.
3. In der Build-Action Xcode mit **iOS-26-SDK** auswählen, damit UIKit das neue Systemmaterial verwendet. App nicht mit einer Kompatibilitätsoption auf das frühere UI festlegen. Auf älteren iOS-Versionen liefert UIKit die dort unterstützte Darstellung.
4. Web-Build für den vorhandenen Capacitor-Basispfad bauen, dann im iOS-Projekt `npx cap sync ios` ausführen und erst danach das Xcode-Archiv erzeugen. Das bestehende Projekt entscheidet über `VITE_BASE` und `webDir`; seine Werte nicht durch die GitHub-Pages-Voreinstellung ersetzen. Die vier Bilddateien unter `src/assets/drinks` und `src/assets/games/wer-bin-ich-new.webp` müssen im Build-Paket landen.

## Was bereits im Web-Code angeschlossen ist

`src/app/NativeAwareTabBar.tsx` lädt Capacitor nur in einer nativen Hülle. Nur auf iOS mit registriertem Plugin `NativeTabs` wird die Web-Leiste nach erfolgreichem `show()` ersetzt. Browser, Android und iOS-Builds ohne Plugin zeigen weiter die bestehende Web-Leiste.

Die Bridge verwendet:

| Richtung | Methode / Ereignis | Inhalt |
| --- | --- | --- |
| Web → iOS | `show` | `{ selected: 0…3, theme: "dark" \| "light" }`, idempotent |
| Web → iOS | `hide` | Leiste ausblenden |
| iOS → Web | `tabSelected` | `{ index: 0…3 }` |

Index 0 = Spiele `/`, 1 = Runde `/lobby`, 2 = Pegel `/pegel`, 3 = Album `/album`. Profil und Spieldetails gehören zur Spiele-Auswahl. Wiederholte Wahl des aktuellen Tabs scrollt nach oben.

Alle nativen Aufträge werden geordnet abgearbeitet. Beim Wechsel ins Vollbildspiel wird ein ausstehendes `show` zuerst beendet und die alte Leiste anschließend versteckt. Abgemeldete Listener dürfen keine Routen mehr ändern. Schlägt die Bridge fehl, werden Listener entfernt, die native Leiste wird bestmöglich versteckt und die Web-Leiste bleibt bedienbar.

UIKit liegt über dem ganzen WebView; ein CSS-`z-index` kann die native Leiste nicht unter ein Sheet legen. Deshalb versteckt die Web-Anbindung UIKit, solange ein Web-Dialog (`role="dialog"`, `aria-modal="true"`) offen oder die App im Hintergrund ist. Beim Schließen des letzten Dialogs kehrt die native Leiste zurück. Neue Dialoge müssen diese Semantik ebenfalls verwenden.

## Was die Vorlage darstellt und was am Gerät zu prüfen bleibt

Die Vorlage ist eine echte `UITabBar` über der bestehenden WebView. Symbole und Material stammen aus UIKit; die Inhalte wechseln weiter über React Router. Vollständige native Container-Übergänge, Navigation-Stacks, minimierende Tab-Leisten und sonstiges Verhalten eines `UITabBarController` werden dadurch nicht automatisch implementiert. Falls diese Containerfunktionen ebenfalls gewünscht sind, den bestehenden Root-Controller entsprechend umbauen und dieselbe Bridge-Schnittstelle beibehalten. Keine zweiten Web-Inhalte pro Tab erzeugen, die Lobby und lokale Runden voneinander trennen würden.

Vor dem TestFlight-Upload am echten Gerät prüfen:

- Nur eine sichtbare Leiste; alle vier Ziele per Tippen und gegebenenfalls Systemgeste erreichbar; interne Links und Zurück aktualisieren die Auswahl.
- Spiel starten/beenden, Kamera, Onboarding und Rechtstexte: keine hängenbleibende native Leiste auf Vollbildseiten.
- Getränkepicker, verschachtelte eigene Karten und Spieleinladung: native Leiste unsichtbar und nicht bedienbar; nach Schließen wieder sichtbar.
- Home-Indikator, Safe Area und Höhen bei kleinem/größerem iPhone, Rotation und Tastatur; Inhalt, Startknopf und Update-Hinweis bleiben erreichbar. Die Web-App reserviert weiterhin `--tabbar-space`.
- App-Farbschema Hell/Dunkel wird auch bei abweichendem iOS-Systemschema übernommen. VoiceOver, größere Schrift, reduzierte Bewegung/Transparenz separat prüfen.
- App während eines Übergangs in den Hintergrund schicken und zurückkehren; keine doppelte Navigation oder doppelte Leiste.

Quellen: [Capacitor – lokale iOS-Plugins und Registrierung](https://capacitorjs.com/docs/ios/custom-code), [Capacitor – eigene Bridge-Controller](https://capacitorjs.com/docs/ios/viewcontroller), [Apple – UIKit und das neue Design](https://developer.apple.com/videos/play/wwdc2025/284/).
