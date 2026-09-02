import { LegalRow, LegalScreen, LegalSection } from './LegalScreen';
import { LEGAL, addressLines } from './site';

/** Pflichtangaben nach § 5 DDG (früher § 5 TMG). */
export function Impressum() {
  const o = LEGAL.operator;
  return (
    <LegalScreen title="Impressum">
      <LegalSection title="Angaben nach § 5 DDG">
        <div className="card stack-2">
          {addressLines().map((line) => (
            <div key={line} className="t-body">
              {line}
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection title="Kontakt">
        <div className="card stack-2">
          <LegalRow label="E-Mail">
            <a href={`mailto:${o.email}`}>{o.email}</a>
          </LegalRow>
          {o.phone && <LegalRow label="Telefon">{o.phone}</LegalRow>}
        </div>
      </LegalSection>

      {(o.register || o.vatId) && (
        <LegalSection title="Unternehmensangaben">
          <div className="card stack-2">
            {o.register && (
              <LegalRow label="Register">
                {o.register.court}, {o.register.number}
              </LegalRow>
            )}
            {o.vatId && <LegalRow label="USt-IdNr. nach § 27a UStG">{o.vatId}</LegalRow>}
          </div>
        </LegalSection>
      )}

      {o.contentResponsible && (
        <LegalSection title="Redaktionell verantwortlich">
          <div className="card">
            <p className="t-body">
              {o.contentResponsible} (§ 18 Abs. 2 MStV), Anschrift wie oben.
            </p>
          </div>
        </LegalSection>
      )}

      <LegalSection title="Streitbeilegung">
        <div className="card">
          <p className="t-body">
            {LEGAL.commercial
              ? 'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.'
              : `${LEGAL.appName} ist ein privates, kostenloses Projekt ohne Verkauf, Werbung oder Nutzerkonten. Es besteht kein Verbrauchervertrag, aus dem ein Schlichtungsverfahren entstehen könnte.`}
          </p>
        </div>
      </LegalSection>

      <LegalSection title="Haftung">
        <div className="card stack-3">
          <p className="t-body">
            <strong>Inhalte.</strong> Die Inhalte dieser App wurden mit Sorgfalt erstellt. Für die
            Richtigkeit, Vollständigkeit und Aktualität wird keine Gewähr übernommen.
          </p>
          <p className="t-body">
            <strong>Alkoholberechnung.</strong> Alle Promillewerte sind Schätzungen nach der
            Widmark-Formel mit Resorptionsmodell. Sie sind keine Messung. Medikamente, Krankheit,
            Müdigkeit, Ernährung und Tagesform verändern die Wirkung erheblich. Die App ersetzt
            keine medizinische Beratung und ist kein Nachweis der Fahrtüchtigkeit. Fahre niemals
            unter Alkoholeinfluss.
          </p>
          <p className="t-body">
            <strong>Links.</strong> Für die Inhalte verlinkter externer Seiten sind deren Betreiber
            verantwortlich. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar.
          </p>
        </div>
      </LegalSection>

      <LegalSection title="Urheberrecht">
        <div className="card">
          <p className="t-body">
            Quellcode, Texte, Icons und Gestaltung dieser App stehen unter dem Urheberrecht des
            Betreibers, soweit nicht anders gekennzeichnet. Genannte Marken und Spielenamen Dritter
            gehören ihren jeweiligen Inhabern und werden nur beschreibend verwendet.
          </p>
        </div>
      </LegalSection>
    </LegalScreen>
  );
}
