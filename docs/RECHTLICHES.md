# Rechtliches — Konzept und Checkliste

Kein Rechtsrat. Das hier ist der Stand nach sorgfältiger Recherche, aufgeschrieben von
einem Entwickler, nicht von einer Anwältin. Bei kommerziellem Betrieb oder Unsicherheit
lohnt eine Stunde Fachberatung mehr als jede Vorlage.

---

## 1. Der Aufbau in der App

Alles Rechtliche liegt in **einer** Datei: `src/legal/site.ts`. Impressum und
Datenschutzerklärung rendern ausschließlich daraus. Kein Fließtext, den man an drei
Stellen nachziehen muss.

```
src/legal/
  site.ts           ← hier ausfüllen. Sonst nichts.
  LegalScreen.tsx   Rahmen, Abschnitte, Zeilen
  Impressum.tsx     § 5 DDG
  Datenschutz.tsx   Art. 13 DSGVO
```

**Solange irgendwo `TODO` steht, zeigen beide Seiten oben eine rote Warnung.** Das ist
Absicht: unfertige Rechtstexte fallen sonst niemandem auf, bis Post kommt.

### Wo die Links sitzen

| Ort | Warum |
|:--|:--|
| Profil → „Daten & Recht" | Der ruhige Platz. Stört beim Spielen niemanden. |
| Startbildschirm des Onboardings, klein unter dem Hinweis | **Pflicht.** Ein Impressum muss erreichbar sein, bevor man irgendetwas ausfüllt. |
| Routen `#/impressum` und `#/datenschutz` | Direkt verlinkbar und teilbar. |

Die beiden Routen umgehen bewusst die Onboarding-Weiterleitung (`PUBLIC_PATHS` in
`src/app/Router.tsx`). Ohne das läge das Impressum hinter einer Registrierungshürde —
genau das, was die Rechtsprechung als „nicht unmittelbar erreichbar" beanstandet.

Bewusst **kein** Eintrag in der Tab-Leiste und **kein** Overlay beim Start.

---

## 2. Was Pflicht ist

### Impressum — § 5 DDG (seit Mai 2024, vorher § 5 TMG)

Pflicht für „geschäftsmäßige" Telemedien. Das Wort wird weit ausgelegt: Es braucht keinen
Gewinn, eine dauerhaft angelegte Seite reicht meistens. Rein private Seiten sind
ausgenommen, aber die Grenze ist unscharf — sobald irgendwo ein Spendenknopf, Werbung,
ein Link aufs Portfolio oder ein Firmenbezug auftaucht, ist sie überschritten.

**Für eine öffentlich erreichbare App: rein damit.** Das Risiko ist einseitig — ein
Impressum zu viel kostet nichts, eines zu wenig ist abmahnfähig.

Pflichtangaben:

- Vor- und Nachname (bzw. Firma mit Rechtsform)
- **Ladungsfähige Anschrift.** Ein Postfach genügt nicht. Wer keine Privatadresse
  veröffentlichen will, braucht eine ladungsfähige Alternative (Gewerbeadresse,
  Impressumsservice). „Adresse auf Anfrage" ist keine.
- E-Mail-Adresse
- Ein zweiter schneller Kontaktweg — Telefon oder ein Kontaktformular, das innerhalb
  von etwa einer Stunde beantwortet wird
- Nur bei Unternehmen: Register und Registernummer, USt-IdNr. nach § 27a UStG
- Nur bei reglementierten Berufen: Kammer, Berufsbezeichnung, Berufsordnung
- Nur bei journalistisch-redaktionellen Inhalten: Verantwortlicher nach § 18 Abs. 2 MStV.
  Ein Spiel hat das nicht.

Es muss **„Impressum" heißen**. „Kontakt", „Info" oder „Über uns" hat Gerichte schon
Fälle kosten lassen.

> **Nicht mehr aufnehmen:** Viele Vorlagen im Netz verlinken noch die
> OS-Plattform der EU (`ec.europa.eu/consumers/odr`). Die wurde am **20. Juli 2025
> abgeschaltet**, die Verlinkungspflicht ist entfallen. Ein toter Link ins Impressum zu
> setzen ist schlechter als keiner. Vor dem Live-Gang kurz gegenprüfen.

### Datenschutzerklärung — Art. 13 DSGVO

Pflicht, sobald personenbezogene Daten verarbeitet werden. Das passiert hier auch ohne
Nutzerkonto: **Jeder Seitenaufruf überträgt die IP-Adresse an den Hoster.** Das genügt.

Enthalten sein müssen: Verantwortlicher, Datenarten, Zwecke, Rechtsgrundlagen,
Empfänger, Drittlandübermittlung, Speicherdauer, Betroffenenrechte, Beschwerderecht bei
der Aufsichtsbehörde, Hinweis auf fehlende automatisierte Entscheidungsfindung.

Alles davon steckt in `Datenschutz.tsx` und zieht sich aus `site.ts`.

---

## 3. Was **nicht** nötig ist — und wann sich das ändert

**Kein Cookie-Banner.**

Die App setzt keine Cookies, kein Tracking, keine Analyse. Sie speichert nur im
`localStorage` und `sessionStorage`. Das ist zwar ein Zugriff auf Endgeräte im Sinne von
**§ 25 TDDDG** (früher TTDSG) und damit grundsätzlich einwilligungspflichtig — aber
Absatz 2 Nr. 2 nimmt aus, was „unbedingt erforderlich" ist, damit der ausdrücklich
gewünschte Dienst funktioniert. Profil, Trink-Log und Lobby-Zustand **sind** der Dienst.

Das kippt, sobald eines davon dazukommt:

| Wenn du … | dann brauchst du … |
|:--|:--|
| Google Analytics, Meta Pixel, Hotjar o. ä. einbaust | echten Consent-Banner mit Ablehnen-Option |
| Google Fonts **von Google-Servern** lädst | Consent (oder besser: Schriften selbst hosten) |
| YouTube/Maps/Vimeo einbettest | Consent oder Zwei-Klick-Lösung |
| Werbung schaltest | Consent |
| Plausible/Matomo **selbst gehostet**, ohne Cookies, IP anonymisiert | in der Regel keinen Banner, aber eine Erwähnung im Datenschutz |

Die App nutzt ausschließlich System-Schriften. Das ist kein Zufall, sondern hält genau
diese Tür zu.

---

## 4. Auszufüllen vor dem Live-Gang

In `src/legal/site.ts`:

- [ ] `operator.name`, `street`, `zip`, `city`
- [ ] `operator.email` — am besten eine eigene Adresse, nicht die private Hauptadresse.
      Sie steht öffentlich im Netz und wird von Spam-Crawlern gefunden.
- [ ] `operator.phone` — optional, aber der sicherste zweite Kontaktweg
- [ ] `supervisoryAuthority` — die Landesdatenschutzbehörde deines **Wohnsitzes**,
      nicht die des Hosters. Liste: `bfdi.bund.de` → Anschriften
- [ ] `commercial` — auf `true`, sobald Werbung, Spendenknopf oder Verkauf dazukommen
- [ ] `url` — auf die echte Adresse, falls du eine eigene Domain nimmst
- [ ] `lastUpdated` — bei jeder inhaltlichen Änderung mitziehen

Danach verschwindet die rote Warnung auf beiden Seiten von selbst.

---

## 5. Was außerhalb des Codes zu tun ist

### Auftragsverarbeitung (Art. 28 DSGVO)

Du gibst Daten an zwei Dienstleister. Für beide brauchst du einen AV-Vertrag:

| Dienst | Wie |
|:--|:--|
| **Google Firebase** | Die *Google Cloud Data Processing Addendum* gilt automatisch mit den Cloud-Nutzungsbedingungen. In der Firebase-Konsole unter „Datenschutz und Sicherheit" bestätigen und den Nachweis als PDF ablegen. |
| **GitHub Pages** | GitHubs *Data Protection Agreement* ist Teil der Terms of Service. Für private Repos ohne Vertrag gilt sie ebenfalls; einmal herunterladen und ablegen. |

„Abgelegt" heißt: irgendwo auffindbar. Es fragt selten jemand, aber wenn, dann kurzfristig.

### Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

Unter 250 Beschäftigten nur nötig, wenn die Verarbeitung nicht bloß gelegentlich erfolgt —
ein dauerhaft laufender Onlinedienst ist regelmäßig. Für dieses Projekt reicht **eine
Seite**: Name, Kontakt, Zwecke, Datenkategorien, Empfänger (Google, GitHub), Fristen,
technische Maßnahmen. Die Inhalte stehen bereits alle in `site.ts` und lassen sich
abschreiben.

### Firebase-Regeln

Die Regeln in `database.rules.json` sind selbst eine Datenschutzmaßnahme: Sie begrenzen,
was ein fremdes Gerät schreiben kann, erzwingen die Feldliste und lassen Lobbys
ablaufen. **Vor dem Live-Gang einspielen** — offene Regeln (`".read": true` global) wären
eine meldepflichtige Panne, sobald jemand sie findet.

### Jugendschutz

Die App zeigt Alkoholkonsum und fordert dazu auf. Sie verkauft keinen Alkohol, damit
greift das Jugendschutzgesetz nur mittelbar; relevant ist der **JMStV** für
entwicklungsbeeinträchtigende Angebote.

Was bereits eingebaut ist und drin bleiben sollte:

- Altersabfrage im Onboarding, Zugang erst ab 16
- Unter 18: alle Spiele laufen zwingend im alkoholfreien Modus, Aufgaben statt Schlucke
- Zielpegel gedeckelt, harter Deckel bei 0,8 ‰, Fahr-Check mit Grün erst bei 0,0 ‰

Optional zusätzlich: ein `age-de-meta-label` im `<head>`, damit Jugendschutzprogramme die
Seite einordnen können. Kein Muss, aber ein billiges Signal für guten Willen.

### Markenrecht — zwei Namen, die ich prüfen würde

Beim Durchgehen der Spieleliste sind mir zwei aufgefallen:

- **„Tabu Rush"** — *TABU* ist eine eingetragene Marke von Hasbro, genau für
  Gesellschaftsspiele. Der Zusatz „Rush" schützt nicht zuverlässig vor
  Verwechslungsgefahr, weil die Warenklasse identisch ist. Das ist von allem hier das
  greifbarste Risiko. Ein neutraler Name wie **„Nicht sagen!"**, **„Verbotene Wörter"**
  oder **„Umschreiben"** löst es in einer Zeile.
- **„Top Ten"** — es gibt ein Brettspiel dieses Namens (Cocktail Games). Der Begriff ist
  weitgehend beschreibend, das Risiko deutlich geringer. Ich würde es notieren, nicht
  überstürzen.

Alle Kartentexte und Icons sind Eigenentwicklung, da ist nichts übernommen. Spielprinzipien
selbst sind nicht urheberrechtlich geschützt — nur Namen, Texte und Gestaltung.

### Barrierefreiheit (BFSG, seit 28. Juni 2025)

Betrifft Dienstleistungen im elektronischen Geschäftsverkehr an Verbraucher. Eine
kostenlose App ohne Vertragsschluss fällt voraussichtlich nicht darunter, zusätzlich gibt
es die Kleinstunternehmer-Ausnahme. **Sobald du etwas verkaufst, ändert sich das.**
Unabhängig davon: Kontraste, Fokus und `aria-label` sind in der App bereits sauber, der
Aufwand zur Konformität wäre gering.

### Eigene Domain

Kommt eine eigene Domain dazu:

- `LEGAL.url` anpassen
- WHOIS-Daten sind bei `.de` nicht mehr öffentlich, ersetzen aber kein Impressum
- Beim Wechsel weg von GitHub Pages den Hoster in `site.ts` austauschen — das ist
  ein Objekt, kein Fließtext

---

## 6. Kurzfassung

| | Status |
|:--|:--|
| Impressum | in der App, zwei Klicks, auch ohne Onboarding erreichbar |
| Datenschutzerklärung | in der App, aus derselben Konfiguration |
| Cookie-Banner | nicht nötig, solange kein Tracking dazukommt |
| AVV Google + GitHub | **du**, einmalig, dauert zehn Minuten |
| Verarbeitungsverzeichnis | **du**, eine Seite |
| Firebase-Regeln scharf schalten | **du**, vor dem Live-Gang |
| Altersgrenzen | eingebaut |
| Haftungsausschluss Alkohol | im Impressum, im Onboarding und im Profil |
| Marke „Tabu Rush" | **prüfen oder umbenennen** |
