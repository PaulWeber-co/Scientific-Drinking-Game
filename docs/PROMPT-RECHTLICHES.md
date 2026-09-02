# Prompt: Impressum und Datenschutz in eine andere App einbauen

Kopiere den Block zwischen den Linien in eine KI (Claude Code, Cursor, Copilot …), die
Zugriff auf das jeweilige Projekt hat. Er ist absichtlich framework-neutral formuliert und
beschreibt das Muster, nicht diesen konkreten Code — so passt sich das Ergebnis an die
Ziel-App an, statt fremde Klassennamen mitzuschleppen.

Vorher zwei Zeilen anpassen (stehen ganz oben im Prompt, mit `>>` markiert).

---

```text
Baue in diese App ein Impressum und eine Datenschutzerklärung ein, nach dem unten
beschriebenen Muster. Deutsches Recht, deutsche Texte.

>> APP-NAME: <Name der App, wie er in den Rechtstexten stehen soll>
>> BETRIEB: <privat und kostenlos | kommerziell (Werbung/Verkauf/Spenden)>

GRUNDREGEL
Alle rechtlichen Stammdaten liegen in genau EINER Konfigurationsdatei. Die beiden Seiten
rendern ausschließlich daraus. Kein Rechtstext als Fließtext an mehreren Stellen. Wer
später etwas ändert, ändert nur die Konfiguration.

SCHRITT 1 — Bestandsaufnahme, bevor du Code schreibst
Sieh dir das Projekt an und beantworte für dich:
  a) Welche Daten speichert die App lokal? Gehe die Storage-Zugriffe wirklich durch
     (localStorage, sessionStorage, IndexedDB, Cookies) und liste Schlüssel für Schlüssel
     auf, was drinsteht.
  b) Welche externen Dienste bekommen Daten? Hoster, Datenbank, Auth, Analytics, Fonts,
     Karten, eingebettete Videos, Fehler-Tracking, Zahlungsanbieter. Prüfe die
     Abhängigkeiten und die Netzwerkaufrufe, nicht nur die README.
  c) Werden Schriften, Icons oder Skripte von fremden Servern geladen? Das ist
     datenschutzrelevant und oft übersehen.
  d) Gibt es Nutzerkonten, E-Mail-Versand, Uploads?
Nenne mir das Ergebnis kurz, bevor du weitermachst. Rate nichts — wenn du etwas nicht
sicher feststellen kannst, schreib das dazu, statt es zu erfinden.

SCHRITT 2 — Konfigurationsdatei
Lege eine Datei an (z. B. src/legal/site.ts, passend zur Projektstruktur) mit einem
typisierten Objekt:

  appName, url, lastUpdated (ISO-Datum)
  commercial: boolean            // steuert Pflichtangaben und Formulierungen
  operator: {
    name, street, zip, city, country, email,
    phone?, register?, vatId?, contentResponsible?
  }
  hosting:    ein Eintrag im unten beschriebenen Dienst-Format
  processors: Liste weiterer Dienste im selben Format
  localStores: [{ key, label, content, retention }]
  supervisoryAuthority: { name, url }

Dienst-Format:
  { label, provider, data, purpose, legalBasis, region, retention, privacyUrl,
    thirdCountry? }
  - provider mit vollständiger Firmenanschrift
  - legalBasis als konkreter Artikel, z. B. "Art. 6 Abs. 1 lit. f DSGVO – berechtigtes
    Interesse an sicherer Auslieferung"
  - thirdCountry nur setzen, wenn Daten die EU verlassen; dann die
    Übermittlungsgrundlage nennen (Angemessenheitsbeschluss / Data Privacy Framework /
    Standardvertragsklauseln)

Fülle alles aus, was du aus dem Projekt sicher ableiten kannst — die Dienste, die
Storage-Schlüssel, die Rechtsgrundlagen. Persönliche Daten des Betreibers (Name,
Anschrift, E-Mail, Telefon, Aufsichtsbehörde) trägst du als Platzhalter "TODO: …" ein.
Erfinde sie nicht.

Exportiere zusätzlich eine Funktion hasPlaceholders(), die true liefert, solange
irgendwo "TODO" steht.

SCHRITT 3 — Zwei Seiten
Impressum (§ 5 DDG):
  - Name und ladungsfähige Anschrift, Kontakt (E-Mail, ggf. Telefon)
  - Register/USt-IdNr. nur rendern, wenn gesetzt
  - § 18 Abs. 2 MStV nur bei journalistisch-redaktionellen Inhalten
  - Streitbeilegung: bei commercial=true die Nichtteilnahme-Erklärung, sonst der
    Hinweis, dass es keinen Verbrauchervertrag gibt
  - Haftung für Inhalte und Links, Urheberrecht
  - WICHTIG: Verlinke NICHT die OS-Plattform der EU. Sie wurde im Juli 2025
    abgeschaltet, die Pflicht ist entfallen. Viele Vorlagen sind hier veraltet.

Datenschutz (Art. 13 DSGVO):
  - Ganz oben ein kurzer Klartext-Kasten: was das Gerät NICHT verlässt. Zuerst die
    Entwarnung, dann die Pflichtangaben.
  - Verantwortlicher
  - Abschnitt "Was auf deinem Gerät bleibt": jeder Storage-Schlüssel einzeln mit Inhalt
    und Löschfrist. Rechtsgrundlage § 25 TDDDG nennen und begründen, ob die
    Erforderlichkeits-Ausnahme greift.
  - Abschnitt "Was das Gerät verlässt": pro Dienst eine Karte mit Anbieter, Daten, Zweck,
    Rechtsgrundlage, Ort, Speicherdauer, ggf. Drittland, Link zu dessen Erklärung
  - Betroffenenrechte (Art. 15–21), Beschwerderecht (Art. 77) mit Aufsichtsbehörde
  - Keine Pflicht zur Bereitstellung, keine automatisierte Entscheidung (Art. 22)
  - Hinweis zum Mindestalter, falls die App eines hat
  - Stand-Datum am Ende

Beide Seiten zeigen ganz oben eine deutlich sichtbare Warnung, solange
hasPlaceholders() true ist. Die Warnung nennt den Dateipfad.

SCHRITT 4 — Einbindung, ohne die Nutzung zu stören
  - Eigene Routen /impressum und /datenschutz. Keine Modals, keine Overlays: die Seiten
    müssen direkt verlinkbar und teilbar sein.
  - Diese Routen müssen JEDE Zugangshürde umgehen — Onboarding-Weiterleitung, Login-Gate,
    Paywall, Altersabfrage. Ein Impressum hinter einer Anmeldung gilt als nicht
    unmittelbar erreichbar. Suche die entsprechende Weiche im Router und nimm die beiden
    Pfade explizit aus.
  - Links an genau zwei Stellen:
      1. In den Einstellungen / im Profil, als normale Listeneinträge.
      2. Klein und unaufdringlich auf dem ersten Bildschirm, den ein neuer Nutzer sieht
         (Startseite, Willkommen, Login) — damit sie auch ohne Konto erreichbar sind.
  - Nicht in die Hauptnavigation, nicht in die Tab-Leiste, kein Banner beim Start.
  - Der Link muss wörtlich "Impressum" heißen. Nicht "Kontakt", nicht "Info",
    nicht "Rechtliches".

SCHRITT 5 — Optik
Verwende ausschließlich die Design-Tokens, Komponenten und CSS-Klassen, die es in dieser
App schon gibt (Navigationsleiste, Karten, Listen, Typografie-Klassen, Farbvariablen).
Führe keine neue Schrift, keine neue Farbe und keine fremde UI-Bibliothek ein. Die Seiten
sollen aussehen wie ein weiterer Bildschirm der App, nicht wie ein eingeklebtes
Rechtsdokument.
Struktur: Überschrift je Abschnitt in der vorhandenen Sektions-Optik, Inhalte in Karten,
Beschriftung/Wert-Paare als kleine Label-Zeile über dem Wert. Zeilenlänge angenehm,
Links umbruchfähig. Hell- und Dunkelmodus müssen beide funktionieren.

SCHRITT 6 — Prüfen
  - Typecheck und Linter laufen lassen.
  - Beide Seiten in einem frischen Browserprofil OHNE abgeschlossenes Onboarding/Login
    aufrufen und bestätigen, dass sie erscheinen.
  - Bestätigen, dass der Link auf dem ersten Bildschirm sichtbar ist und funktioniert.

SCHRITT 7 — Bericht
Sag mir am Ende:
  - welche Dienste du im Projekt gefunden hast und was sie an Daten sehen,
  - ob ein Cookie-Banner nötig ist. Begründe die Antwort mit § 25 TDDDG: Tracking,
    Analytics, Werbung, externe Schriften und eingebettete Videos brauchen Einwilligung;
    rein funktionaler lokaler Speicher nicht.
  - welche Felder ich noch ausfüllen muss,
  - was ich außerhalb des Codes erledigen muss (AV-Verträge mit den Dienstleistern,
    Verzeichnis von Verarbeitungstätigkeiten, Zugriffsregeln der Datenbank),
  - ob dir Namen, Logos oder Inhalte aufgefallen sind, die fremde Marken oder fremdes
    Urheberrecht berühren könnten.

Erfinde keine Rechtsstände und keine Paragraphen. Wenn du bei einer Angabe unsicher bist,
schreib sie als TODO mit einem Hinweis, was zu prüfen ist, statt zu raten.
```

---

## Wenn die Ziel-App anders gebaut ist

Der Prompt funktioniert auch außerhalb von React. Zwei Zusätze, je nach Projekt:

**Next.js / Server-Rendering.** Ergänze:
> Die Seiten sollen statisch gerendert und indexierbar sein. Lege sie unter
> `app/impressum/page.tsx` und `app/datenschutz/page.tsx` an und setze passende Metadaten.

**Native App (React Native, Flutter, Swift).** Ergänze:
> Impressum und Datenschutz gehören zusätzlich in den Store-Eintrag. Die
> Datenschutzerklärung braucht eine öffentlich erreichbare URL — Apple und Google
> verlangen sie bei der Einreichung. In der App verlinkst du sie unter Einstellungen.

**Statische Seite ohne Router.** Ergänze:
> Lege `impressum.html` und `datenschutz.html` an und verlinke sie im Footer jeder Seite.
> Die Stammdaten kommen aus einer gemeinsamen Datei, die beim Build eingesetzt wird.
