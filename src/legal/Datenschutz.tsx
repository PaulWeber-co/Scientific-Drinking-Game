import { LegalRow, LegalScreen, LegalSection } from './LegalScreen';
import { LEGAL, addressLines } from './site';
import type { Processor } from './site';

/** Informationspflichten nach Art. 13 DSGVO. */
export function Datenschutz() {
  const o = LEGAL.operator;
  return (
    <LegalScreen title="Datenschutz">
      <div className="notice notice--green">
        <strong>Das Wichtigste zuerst.</strong> Deine Körperdaten – Alter, Gewicht, Größe,
        Geschlecht – und dein Trink-Log verlassen dieses Gerät nie. Sie werden nirgendwo
        hochgeladen, nicht ausgewertet und nicht weitergegeben. {LEGAL.appName} hat keine
        Nutzerkonten, keine Werbung, kein Tracking und keine Analyse-Werkzeuge.
      </div>

      <LegalSection title="Verantwortlicher">
        <div className="card stack-2">
          {addressLines().map((line) => (
            <div key={line} className="t-body">
              {line}
            </div>
          ))}
          <LegalRow label="E-Mail">
            <a href={`mailto:${o.email}`}>{o.email}</a>
          </LegalRow>
        </div>
      </LegalSection>

      <LegalSection title="Was auf deinem Gerät bleibt">
        <div className="card stack-3">
          <p className="t-body">
            Die App speichert ihre Daten im lokalen Speicher deines Browsers. Diese Daten werden
            nicht an den Betreiber übertragen. Rechtsgrundlage für das Speichern auf dem Endgerät
            ist § 25 Abs. 2 Nr. 2 TDDDG: Die Speicherung ist unbedingt erforderlich, damit die von
            dir ausdrücklich gewünschte Funktion überhaupt läuft. Deshalb gibt es hier auch kein
            Cookie-Banner – es gibt nichts einzuwilligen.
          </p>
          {LEGAL.localStores.map((s) => (
            <div key={s.key} className="legal__block">
              <div className="t-headline">{s.label}</div>
              <div className="t-caption">
                <code>{s.key}</code>
              </div>
              <p className="t-sub">{s.content}</p>
              <p className="t-caption">{s.retention}</p>
            </div>
          ))}
          <p className="t-sub">
            Du löschst alles jederzeit selbst: im Profil unter „Alles zurücksetzen" oder über die
            Browsereinstellungen.
          </p>
        </div>
      </LegalSection>

      <LegalSection title="Was das Gerät verlässt">
        <div className="card stack-3">
          <p className="t-body">
            Nur zwei Dinge führen zu einer Datenverarbeitung außerhalb deines Geräts: der Abruf der
            Seite selbst und – falls du sie benutzt – die Online-Lobby.
          </p>
        </div>
        <ProcessorCard p={LEGAL.hosting} />
        {LEGAL.processors.map((p) => (
          <ProcessorCard key={p.label} p={p} />
        ))}
      </LegalSection>

      <LegalSection title="Deine Rechte">
        <div className="card stack-3">
          <p className="t-body">
            Dir stehen gegenüber dem Verantwortlichen die Rechte auf Auskunft (Art. 15 DSGVO),
            Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18),
            Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO) zu.
          </p>
          <p className="t-body">
            In der Praxis liegen fast alle Daten allein bei dir: Was auf dem Gerät gespeichert ist,
            kannst du selbst einsehen, ändern und löschen, ohne uns fragen zu müssen.
          </p>
          <p className="t-body">
            Unabhängig davon kannst du dich bei einer Aufsichtsbehörde beschweren (Art. 77 DSGVO).
            Zuständig ist{' '}
            <a href={LEGAL.supervisoryAuthority.url} target="_blank" rel="noreferrer noopener">
              {LEGAL.supervisoryAuthority.name}
            </a>
            .
          </p>
        </div>
      </LegalSection>

      <LegalSection title="Weitere Hinweise">
        <div className="card stack-3">
          <p className="t-body">
            <strong>Keine Pflicht zur Bereitstellung.</strong> Du musst keine Daten angeben. Ohne
            Körperdaten kann die App die persönliche Schluckzahl allerdings nicht berechnen.
          </p>
          <p className="t-body">
            <strong>Keine automatisierte Entscheidung.</strong> Es findet kein Profiling und keine
            automatisierte Entscheidung mit rechtlicher Wirkung nach Art. 22 DSGVO statt. Die
            Promilleschätzung ist eine Rechenhilfe, keine Entscheidung über dich.
          </p>
          <p className="t-body">
            <strong>Alter.</strong> Die App richtet sich an Personen ab 16 Jahren. Alkoholbezogene
            Funktionen sind erst ab 18 freigeschaltet; darunter laufen alle Spiele im
            alkoholfreien Modus.
          </p>
          <p className="t-body">
            <strong>Änderungen.</strong> Diese Erklärung wird angepasst, wenn sich die App ändert.
            Es gilt die hier veröffentlichte Fassung.
          </p>
        </div>
      </LegalSection>
    </LegalScreen>
  );
}

function ProcessorCard({ p }: { p: Processor }) {
  return (
    <div className="card stack-2">
      <div className="t-headline">{p.label}</div>
      <LegalRow label="Anbieter">{p.provider}</LegalRow>
      <LegalRow label="Daten">{p.data}</LegalRow>
      <LegalRow label="Zweck">{p.purpose}</LegalRow>
      <LegalRow label="Rechtsgrundlage">{p.legalBasis}</LegalRow>
      <LegalRow label="Ort">{p.region}</LegalRow>
      <LegalRow label="Speicherdauer">{p.retention}</LegalRow>
      {p.thirdCountry && <LegalRow label="Drittland">{p.thirdCountry}</LegalRow>}
      <LegalRow label="Datenschutzerklärung">
        <a href={p.privacyUrl} target="_blank" rel="noreferrer noopener">
          {new URL(p.privacyUrl).host}
        </a>
      </LegalRow>
    </div>
  );
}
