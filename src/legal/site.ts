/**
 * Rechtliche Stammdaten der App – eine Datei, ein Ort.
 *
 * Impressum und Datenschutzerklärung rendern ausschließlich aus diesem Objekt.
 * Wer die App forkt oder das Muster in eine andere App übernimmt, ändert nur
 * hier etwas und muss keine Fließtexte durchsuchen.
 *
 * ▸ Alle Felder mit TODO müssen vor dem Live-Gang ausgefüllt werden.
 *   Solange ein TODO drinsteht, zeigen beide Seiten eine sichtbare Warnung.
 */

export interface Operator {
  /** Vor- und Nachname bzw. Firma inkl. Rechtsform. */
  name: string;
  /** Straße und Hausnummer. Ein Postfach reicht nach § 5 DDG nicht. */
  street: string;
  zip: string;
  city: string;
  country: string;
  email: string;
  /** Zweiter schneller Kontaktweg. Leer lassen, wenn es keinen gibt. */
  phone?: string;
  /** Nur bei Unternehmen: Registergericht und -nummer. */
  register?: { court: string; number: string };
  /** Nur bei Unternehmen mit USt-IdNr. nach § 27a UStG. */
  vatId?: string;
  /**
   * Inhaltlich verantwortlich nach § 18 Abs. 2 MStV. Nur nötig, wenn die Seite
   * journalistisch-redaktionelle Inhalte hat (Blog, News). Ein Spiel hat das
   * in der Regel nicht.
   */
  contentResponsible?: string;
}

export interface Processor {
  /** Was der Dienst in der App tut. */
  label: string;
  /** Anbieter mit Sitz. */
  provider: string;
  /** Welche Daten dort verarbeitet werden. */
  data: string;
  purpose: string;
  /** Art. 6 Abs. 1 DSGVO. */
  legalBasis: string;
  /** Wo die Daten liegen. */
  region: string;
  /** Aufbewahrung / Löschung. */
  retention: string;
  privacyUrl: string;
  /** Gesetzt, wenn Daten in ein Drittland gehen – dann Übermittlungsgrundlage angeben. */
  thirdCountry?: string;
}

export interface LocalStore {
  key: string;
  label: string;
  content: string;
  retention: string;
}

export interface LegalConfig {
  appName: string;
  url: string;
  lastUpdated: string;
  commercial: boolean;
  operator: Operator;
  hosting: Processor;
  processors: Processor[];
  localStores: LocalStore[];
  supervisoryAuthority: { name: string; url: string };
}

export const LEGAL: LegalConfig = {
  /** Name der App, wie er in den Rechtstexten auftaucht. */
  appName: 'Pegel',
  /** Öffentliche Adresse der App. */
  url: 'https://paulweber-co.github.io/Scientific-Drinking-Game/',
  /** Datum der letzten inhaltlichen Änderung an Impressum/Datenschutz. */
  lastUpdated: '2026-09-02',

  /**
   * false = private, unentgeltliche Seite ohne Werbung, ohne Verkauf.
   * true  = geschäftsmäßig (Werbung, Spendenbutton, Verkauf, Firmenbezug).
   * Steuert Pflichtangaben wie USt-IdNr. und Verbraucherschlichtung.
   */
  commercial: false,

  operator: {
    name: 'Paul Weber',
    street: 'Jäckbornsweg',
    zip: '22927',
    city: 'Großhansdorf',
    country: 'Deutschland',
    email: 'PaulWeber@protonmail.ch',
    phone: undefined,
  },

  /** Wer die Dateien ausliefert. */
  hosting: {
    label: 'Hosting der Webseite',
    provider: 'GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA',
    data: 'IP-Adresse, Datum und Uhrzeit des Abrufs, aufgerufene Datei, übertragene Datenmenge, Browser- und Betriebssystemkennung',
    purpose: 'Technische Auslieferung der Seite und Abwehr von Angriffen',
    legalBasis:
      'Art. 6 Abs. 1 lit. f DSGVO – berechtigtes Interesse an einem sicheren, funktionsfähigen Angebot',
    region: 'Weltweites CDN, Serverstandort auch außerhalb der EU',
    retention: 'Server-Logs von GitHub, Löschung nach den Fristen von GitHub',
    privacyUrl: 'https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement',
    thirdCountry:
      'USA. GitHub gehört zu Microsoft; Microsoft ist nach dem EU-U.S. Data Privacy Framework zertifiziert (Angemessenheitsbeschluss der EU-Kommission vom 10.07.2023). Ergänzend gelten die Standardvertragsklauseln.',
  },

  /** Alles, was außerhalb des Geräts noch Daten sieht. */
  processors: [
    {
      label: 'Online-Lobby (nur wenn du eine startest oder beitrittst)',
      provider: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland',
      data: 'Spitzname, Avatarfarbe, Getränke-Symbol, Rolle „fährt heute", grobe Pegel-Zone (nüchtern/aufwärmen/sweet spot/grenzbereich), Zeitstempel, zufälliger Gerätecode, Lobby-Code, Spielstand des laufenden Spiels sowie die IP-Adresse der Verbindung',
      purpose:
        'Damit mehrere Geräte dieselbe Runde sehen. Ohne Lobby wird zu Google keine Verbindung aufgebaut.',
      legalBasis:
        'Art. 6 Abs. 1 lit. b DSGVO – Durchführung der von dir angeforderten Funktion',
      region: 'Firebase Realtime Database, Region europe-west1 (Belgien)',
      retention:
        'Lobbys löschen sich spätestens 8 Stunden nach der letzten Aktivität selbst. Beim Verlassen wird der eigene Eintrag sofort entfernt.',
      privacyUrl: 'https://firebase.google.com/support/privacy',
      thirdCountry:
        'Die Daten liegen in der EU. Ein Zugriff durch Google LLC (USA) im Rahmen von Support und Wartung ist nicht ausgeschlossen; Google ist nach dem EU-U.S. Data Privacy Framework zertifiziert, ergänzend gelten die Standardvertragsklauseln.',
    },
  ],

  /** Was ausschließlich im Browser bleibt. Wichtig für § 25 TDDDG. */
  localStores: [
    {
      key: 'sdg.player',
      label: 'Profil und Trink-Log',
      content:
        'Spitzname, Avatarfarbe, Alter, Geschlecht, Gewicht, optional Körpergröße, Magenfüllung, Zielpegel, gewähltes Getränk, eigene Getränke und die Liste der eingetragenen Schlucke',
      retention: 'Bleibt bis du „Alles zurücksetzen" drückst oder die Browserdaten löschst.',
    },
    {
      key: 'sdg.app',
      label: 'App-Einstellungen',
      content:
        'Darstellung hell/dunkel, Vibration, Wasser-Erinnerung, bestätigter Hinweis beim Start, zuletzt gespielte Spiele, Spicy-Schalter je Spiel',
      retention: 'Bleibt bis du die Browserdaten löschst.',
    },
    {
      key: 'sdg.local-players',
      label: 'Mitspieler im Pass-&-Play',
      content:
        'Name, Farbe, Alter, Geschlecht, Gewicht und Getränk der Gäste, die du auf diesem Gerät angelegt hast',
      retention: 'Liegt im sessionStorage und verschwindet, sobald du den Tab schließt.',
    },
  ],

  /**
   * Aufsichtsbehörde für Beschwerden nach Art. 77 DSGVO.
   * Zuständig ist die Behörde am Wohnsitz des Verantwortlichen – bitte an das
   * eigene Bundesland anpassen.
   */
  supervisoryAuthority: {
    name: 'TODO: Landesdatenschutzbehörde deines Bundeslandes',
    url: 'https://www.bfdi.bund.de/DE/Service/Anschriften/anschriften_node.html',
  },
};

/** true, sobald irgendwo noch ein TODO steht. */
export function hasPlaceholders(): boolean {
  return JSON.stringify(LEGAL).includes('TODO');
}

/** Adresse als Zeilen, wie sie im Impressum stehen soll. */
export function addressLines(): string[] {
  const o = LEGAL.operator;
  return [o.name, o.street, `${o.zip} ${o.city}`, o.country];
}
