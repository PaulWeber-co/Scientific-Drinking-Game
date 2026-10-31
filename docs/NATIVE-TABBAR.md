# Native iOS-Tab-Leiste für den TestFlight-Build

## To-do im iOS-Build (für den Kollegen)

Der Web-Build zeigt die animierte CSS-Leiste. Die React-Seite versucht auf iOS nur dann auf die native Leiste umzuschalten, wenn Capacitor das Plugin `NativeTabs` tatsächlich registriert hat und `show()` erfolgreich war. Ohne Plugin bleibt die Web-Leiste sichtbar. Die vier Ziele sind in `src/app/NativeAwareTabBar.tsx` festgelegt: Spiele `/`, Runde `/lobby`, Pegel `/pegel`, Album `/album`. Laufende Spiele und Onboarding verwenden weiterhin das Vollbildlayout ohne Leiste.

1. Im **bestehenden** iOS-/TestFlight-Xcode-Projekt `native/ios/NativeTabsPlugin.swift` ins App-Target kopieren. Das native Projekt ist in diesem Repository derzeit nicht enthalten; seine Bundle-ID, Signierung und Build-Action müssen im bestehenden Projekt bleiben.
2. Falls noch kein eigener Bridge-Controller existiert: `MyViewController: CAPBridgeViewController` anlegen und in `Main.storyboard` als Custom Class des Bridge View Controllers eintragen. Im bestehenden Controller `capacitorDidLoad()` ergänzen (vorhandene Plugin-Registrierungen beibehalten):

   ```swift
   override open func capacitorDidLoad() {
       super.capacitorDidLoad()
       bridge?.registerPluginInstance(NativeTabsPlugin())
   }
   ```

3. Mit Xcode und dem **iOS-26-SDK** bauen. UIKit liefert das Systemmaterial für die native `UITabBar`; CSS kann die systemeigene Lichtbrechung, Kontrastanpassung und Gestenanimation nicht exakt kopieren. Vor TestFlight auf einem iPhone prüfen: vier Tabs, Wechsel aus der Webansicht und zurück, Tab-Auswahl nach internem Link, Safe Area, Dark/Light, VoiceOver, reduzierte Transparenz und Öffnen/Schließen eines laufenden Spiels. Bei alten iOS-Versionen zeichnet UIKit seine jeweilige Systemdarstellung.
4. Im iOS-Projekt gegebenenfalls den WebView-Inhalt oberhalb der nativen Leiste begrenzen bzw. Safe-Area-Abstand prüfen. Die Web-App reserviert bereits `--tabbar-space` für Inhalte. `npx cap sync ios` nach dem Web-Build laufen lassen, bevor Xcode archiviert wird.

Die [Capacitor-Anleitung für lokale iOS-Plugins](https://capacitorjs.com/docs/ios/custom-code) beschreibt Registrierung und Bridge. Apple zeigt die systemeigene Leiste und ihre automatische Liquid-Glass-Darstellung im [WWDC25-UIKit-Video](https://developer.apple.com/videos/play/wwdc2025/284/). Der Swift-Code ist eine Integrationsvorlage; hier unter Linux ist weder das fremde Xcode-Projekt noch ein iOS-Simulator vorhanden, daher muss der Kollege die iOS-Kompilierung und das Layout im echten Projekt verifizieren.
