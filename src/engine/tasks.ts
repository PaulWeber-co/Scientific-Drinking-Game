import { shuffle } from '../lib/format';
import { freshestFirst, seenKey } from '../lib/seen';

/**
 * Aufgaben für die Runden ohne Schlucke.
 *
 * Die App verspricht an sieben Stellen „Aufgaben statt Schlucke" – für
 * Fahrer, unter 18 und alkoholfrei. Bis hierher war das nur eine
 * Überschrift. Dazu kommt der häufigste Fall überhaupt: ab der zweiten
 * Stunde sind je nach Getränk 51–86 % aller Ansagen ein Aussetzer.
 *
 * Zwei Sorten, weil die beiden Lagen verschieden sind:
 *  - `share`  gibt Macht ab: wer nicht trinkt, bestimmt über die Runde.
 *  - `action` gibt etwas zu tun, ohne dass irgendwer trinkt.
 *
 * **Keine Aufgabe nennt eine Schluckzahl.** Wie viel jemand trinkt, rechnet
 * sein eigenes Gerät aus seinen Körperdaten; ein Spiel meldet nur Härte.
 * Verteil-Aufgaben benennen deshalb Personen und Regeln („für sie zählt die
 * nächste Ansage doppelt"), nie eine Menge.
 */

export type TaskKind = 'share' | 'action';

/** Warum es gerade keine Schlucke gibt. Leitet sich aus `SipResult` ab. */
export type TaskReason = 'blocked' | 'maintaining' | 'water';

/** Wie oft es beim Aussetzen eine Aufgabe gibt. Gesperrte bekommen immer eine. */
export type TaskFrequency = 'aus' | 'manchmal' | 'immer';

export interface TaskDef {
  text: string;
  kind: TaskKind;
  /** Liegt nur im Topf, wenn der Spicy-Schalter des Spiels an ist. */
  spicy?: boolean;
}

export interface TaskContext {
  reason: TaskReason;
  /**
   * Stabil pro Ansage. Gleiche Runde und gleicher Spieler ergeben dieselbe
   * Aufgabe – sonst würde jeder Re-Render eine neue Aufgabe zeigen.
   */
  seed: string;
  spicy: boolean;
  frequency: TaskFrequency;
  /** Gedächtnisstand aus `store/seen`. Leer = nichts gesehen. */
  seen: Readonly<Record<string, number>>;
}

/**
 * Die Aufgabe für diese Ansage – oder `null`, wenn es diesmal keine gibt.
 *
 * Gesperrte Spieler bekommen immer eine: für sie ist es der ganze Abend.
 * Beim Aussetzen entscheidet die Einstellung, bei „manchmal" etwa jedes
 * zweite Mal. Alles hängt am Seed, nichts an `Math.random` – die Auswahl
 * läuft in einer Komponente und muss über Re-Render hinweg stehen bleiben.
 */
export function taskFor(ctx: TaskContext): TaskDef | null {
  if (ctx.reason !== 'blocked') {
    if (ctx.frequency === 'aus') return null;
    if (ctx.frequency === 'manchmal' && hash32(`${ctx.seed}·ob`) % 2 === 0) return null;
  }

  // Wer gesperrt ist, sitzt den ganzen Abend daneben und bekommt deshalb
  // bevorzugt Einfluss auf die Runde. Wer nur gerade über dem Pegel liegt,
  // ist gleich wieder dabei – für den reicht etwas zu tun. „Bevorzugt"
  // heißt drei von vier Mal, sonst wäre es zwei getrennte Kataloge.
  const preferred: TaskKind = ctx.reason === 'blocked' ? 'share' : 'action';
  const kind: TaskKind =
    hash32(`${ctx.seed}·art`) % 4 === 0 ? (preferred === 'share' ? 'action' : 'share') : preferred;

  const pool = TASKS.filter((t) => t.kind === kind && (ctx.spicy || !t.spicy));
  const varied = shuffle(pool, mulberry32(hash32(ctx.seed)));
  return freshestFirst(varied, (t) => seenKey(t.text), ctx.seen)[0] ?? null;
}

/** FNV-1a, 32 Bit. Gleicher Text, gleiche Zahl – auf jedem Gerät. */
function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Kleiner deterministischer Zufall, damit `shuffle` ohne `Math.random` läuft. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Der Katalog. Texte sind zum Vorlesen geschrieben – die Aufgabe steht nur
 * auf dem eigenen Handy, die Runde erfährt sie durch die Person selbst.
 */
export const TASKS: readonly TaskDef[] = [
  // ── Macht abgeben: wer nicht trinkt, bestimmt ──────────────────────────
  { kind: 'share', text: 'Zeig auf eine Person. Für sie zählt die nächste Ansage doppelt.' },
  { kind: 'share', text: 'Such dir jemanden aus, der die nächste Karte vorliest.' },
  { kind: 'share', text: 'Du bestimmst, wer als Nächstes dran ist. Sag den Namen laut.' },
  { kind: 'share', text: 'Nenn eine Eigenschaft. Alle, auf die sie zutrifft, nehmen die nächste Ansage mit.' },
  { kind: 'share', text: 'Alle links von dir nehmen die nächste Ansage mit.' },
  { kind: 'share', text: 'Wähle zwei Personen. Sie tauschen für den Rest der Runde die Plätze.' },
  { kind: 'share', text: 'Bestimme ein Wort, das ab jetzt verboten ist. Wer es sagt, nimmt die nächste Ansage mit.' },
  { kind: 'share', text: 'Du darfst eine Person eine Runde lang komplett aussetzen lassen. Wähle.' },
  { kind: 'share', text: 'Such die Person aus, die am längsten nichts gesagt hat. Sie erzählt etwas.' },
  { kind: 'share', text: 'Bestimme, wer die nächste Aufgabe für dich übernimmt.' },
  { kind: 'share', text: 'Zeig auf jemanden. Die Person muss bis zur nächsten Runde stehen bleiben.' },
  { kind: 'share', text: 'Wähle eine Person, die ab jetzt jeden Satz mit „ehrlich gesagt" beginnen muss.' },
  { kind: 'share', text: 'Bestimme zwei Personen, die sich für eine Runde nicht ansehen dürfen.' },
  { kind: 'share', text: 'Such jemanden aus, der bis zur nächsten Runde deinen Namen trägt.' },
  { kind: 'share', text: 'Du gibst die Regel vor: Wer als Nächstes lacht, nimmt die nächste Ansage mit.' },
  { kind: 'share', text: 'Wähle eine Person. Sie darf eine Runde lang nur mit Ja oder Nein antworten.' },
  { kind: 'share', text: 'Bestimme, wer aufsteht und allen etwas zu trinken nachschenkt.' },
  { kind: 'share', text: 'Zeig auf zwei Personen. Sie müssen sich einigen, wer von beiden die nächste Ansage doppelt nimmt.' },
  { kind: 'share', text: 'Such die Person mit dem vollsten Glas. Sie ist die nächste Runde dran.' },
  { kind: 'share', text: 'Du drehst die Reihenfolge um. Ab jetzt geht es andersherum um den Tisch.' },
  { kind: 'share', text: 'Wähle eine Person, die ab jetzt jede Frage mit einer Gegenfrage beantworten muss.' },
  { kind: 'share', text: 'Bestimme, wer für die nächsten drei Runden die Musik aussucht.' },
  { kind: 'share', text: 'Zeig auf jemanden. Ihr beide seid für eine Runde ein Team – was einer bekommt, teilt ihr euch.' },
  { kind: 'share', text: 'Such jemanden aus, der eine Runde lang für dich mitreden muss.' },
  { kind: 'share', text: 'Du darfst eine Regel aus diesem Spiel für eine Runde außer Kraft setzen. Sag welche.' },
  { kind: 'share', text: 'Bestimme, wer als Nächstes ein Glas Wasser trinkt. Diese Runde geht auf dich.' },
  { kind: 'share', text: 'Wähle die Person, die deiner Meinung nach am nüchternsten wirkt. Sie widerspricht oder nimmt die nächste Ansage mit.' },
  { kind: 'share', text: 'Zeig auf jemanden. Er oder sie muss den nächsten Satz auf Englisch sagen.' },
  { kind: 'share', text: 'Such dir eine Person aus, die bis zur nächsten Runde jede deiner Aussagen bestätigen muss – auch die falschen.' },
  { kind: 'share', text: 'Bestimme, wer in dieser Runde das Sagen hat. Was die Person anordnet, gilt bis zur nächsten Karte.' },
  { kind: 'share', text: 'Du entscheidest, ob die nächste Runde härter oder milder läuft. Sag es an.' },
  { kind: 'share', text: 'Wähle eine Person, die eine Runde lang alles doppelt sagen muss.' },
  { kind: 'share', text: 'Zeig auf die Person, die am weitesten weg wohnt. Sie erzählt, wie sie heute nach Hause kommt.' },
  { kind: 'share', text: 'Bestimme, wer die nächste Runde ansagen darf – du gibst nur das Startwort.' },
  { kind: 'share', text: 'Such jemanden aus, der einen Witz erzählt. Kommt kein Lachen, nimmt er die nächste Ansage mit.' },
  { kind: 'share', text: 'Wähle zwei Personen. Sie müssen sich gegenseitig ein ehrliches Kompliment machen.' },
  { kind: 'share', text: 'Du gibst eine Farbe vor. Wer sie nicht am Körper trägt, nimmt die nächste Ansage mit.' },
  { kind: 'share', text: 'Bestimme, wer bis zur nächsten Runde dein Glas hält.' },
  { kind: 'share', text: 'Zeig auf jemanden. Die Person erzählt, was sie an dir zuerst bemerkt hat.' },
  { kind: 'share', text: 'Such dir eine Person aus, die erzählt, wann sie zuletzt geflirtet hat und wie es ausging.', spicy: true },
  { kind: 'share', text: 'Bestimme, wer die peinlichste Nachricht in seinem Handy vorliest.', spicy: true },
  { kind: 'share', text: 'Such jemanden aus, der beichten muss, worauf er beim Kennenlernen zuerst achtet.', spicy: true },
  { kind: 'share', text: 'Du bestimmst, wer verrät, wie viele Dates in diesem Jahr schon dabei waren.', spicy: true },
  { kind: 'share', text: 'Du bestimmst, wer seinen letzten Suchverlauf vorliest.', spicy: true },

  // ── Etwas zu tun, ohne dass jemand trinkt ──────────────────────────────
  { kind: 'action', text: 'Sprich bis zur nächsten Runde nur im Flüsterton.' },
  { kind: 'action', text: 'Erzähl in fünfzehn Sekunden deinen peinlichsten Moment.' },
  { kind: 'action', text: 'Mach fünf Kniebeugen. Zähl laut mit.' },
  { kind: 'action', text: 'Rede eine Runde lang nur in der dritten Person über dich.' },
  { kind: 'action', text: 'Erfinde einen Werbespruch für das Getränk deines Nachbarn.' },
  { kind: 'action', text: 'Zeig eins der letzten zehn Fotos in deiner Galerie. Du suchst aus.' },
  { kind: 'action', text: 'Mach die Person nach, die zuletzt etwas gesagt hat.' },
  { kind: 'action', text: 'Nenn drei Dinge, die du heute gut gemacht hast.' },
  { kind: 'action', text: 'Sing den nächsten Satz, statt ihn zu sagen.' },
  { kind: 'action', text: 'Schätz zwanzig Sekunden ab, ohne auf eine Uhr zu sehen. Sag „jetzt", wenn du meinst.' },
  { kind: 'action', text: 'Erzähl eine Lüge, die so klingt wie die Wahrheit. Die Runde rät.' },
  { kind: 'action', text: 'Beschreibe die Person rechts von dir in genau drei Wörtern.' },
  { kind: 'action', text: 'Sag das Alphabet rückwärts von M bis A.' },
  { kind: 'action', text: 'Erzähl den letzten Traum, an den du dich erinnerst.' },
  { kind: 'action', text: 'Steh zehn Sekunden auf einem Bein, ohne dich abzustützen.' },
  { kind: 'action', text: 'Sprich eine Runde lang nur in Fragen.' },
  { kind: 'action', text: 'Nenn fünf Dinge in diesem Raum, die blau sind. Du hast zehn Sekunden.' },
  { kind: 'action', text: 'Mach ein Geräusch, das zu deiner Stimmung passt. Ohne Erklärung.' },
  { kind: 'action', text: 'Erzähl von der schlechtesten Entscheidung, die trotzdem gut ausging.' },
  { kind: 'action', text: 'Verstell deine Stimme, bis du wieder an der Reihe bist.' },
  { kind: 'action', text: 'Zeig deinen letzten Kontostand – oder erzähl, wofür das letzte Geld draufging.' },
  { kind: 'action', text: 'Erfinde einen neuen Namen für dieses Spiel. Er muss ernst gemeint klingen.' },
  { kind: 'action', text: 'Steh auf und wechsle den Platz mit der Person gegenüber.' },
  { kind: 'action', text: 'Nenn eine Meinung, für die dich alle hier auslachen werden.' },
  { kind: 'action', text: 'Zähl bis zwanzig, aber lass jede Zahl aus, in der eine Drei vorkommt.' },
  { kind: 'action', text: 'Erzähl, was du gemacht hättest, wenn du heute nicht hier wärst.' },
  { kind: 'action', text: 'Sag jedem am Tisch in einem Wort, wofür du ihn schätzt.' },
  { kind: 'action', text: 'Mach zehn Sekunden lang ein völlig ausdrucksloses Gesicht. Alle schauen zu.' },
  { kind: 'action', text: 'Erklär deinen Beruf oder dein Studium, als wärst du fünf Jahre alt.' },
  { kind: 'action', text: 'Schreib die nächste Nachricht, die du verschickst, ohne Vokale.' },
  { kind: 'action', text: 'Nenn die letzten drei Songs, die bei dir liefen. Ehrlich.' },
  { kind: 'action', text: 'Erzähl in einem Satz, worauf du dich diese Woche freust.' },
  { kind: 'action', text: 'Steh auf und mach zehn Sekunden lang deinen besten Tanzschritt.' },
  { kind: 'action', text: 'Sprich eine Runde lang ohne das Wort „ich".' },
  { kind: 'action', text: 'Beschreibe den letzten Film, den du gesehen hast, ohne den Titel zu nennen.' },
  { kind: 'action', text: 'Nimm ein Glas Wasser. Ganz oder gar nicht.' },
  { kind: 'action', text: 'Erzähl, welchen Rat du dir mit sechzehn gegeben hättest.' },
  { kind: 'action', text: 'Mach ein Selfie mit der Person neben dir. Zeigen musst du es nicht.' },
  { kind: 'action', text: 'Sag einen Zungenbrecher dreimal hintereinander. Deine Wahl.' },
  { kind: 'action', text: 'Erklär in dreißig Sekunden, warum dein Lieblingsessen das beste ist.' },
  { kind: 'action', text: 'Nenn etwas, das alle hier mögen und du überhaupt nicht.' },
  { kind: 'action', text: 'Halte deine Hand eine Runde lang oben, ohne sie abzusetzen.' },
  { kind: 'action', text: 'Erzähl von einer Narbe – die Geschichte, nicht die Narbe.' },
  { kind: 'action', text: 'Rate, wie viele Geschwister die Person gegenüber hat. Laut geraten.' },
  { kind: 'action', text: 'Nenn ein Wort, das es nicht gibt, und erklär seine Bedeutung.' },
  { kind: 'action', text: 'Sprich bis zur nächsten Runde in Reimen. Schlechte Reime zählen.' },
  { kind: 'action', text: 'Erzähl, was du zuletzt gekauft und sofort bereut hast.' },
  { kind: 'action', text: 'Ahme das Lachen einer Person am Tisch nach. Die anderen raten.' },
  { kind: 'action', text: 'Streck dich einmal richtig durch. Die ganze Runde macht mit.' },
  { kind: 'action', text: 'Nenn drei Dinge, die du kannst und die niemand hier von dir weiß.' },
  { kind: 'action', text: 'Erklär die Regeln dieses Spiels in zehn Sekunden. Los.' },
  { kind: 'action', text: 'Sag der Person links von dir etwas, das sie noch nicht über dich weiß.' },
  { kind: 'action', text: 'Erzähl vom letzten Mal, an dem du richtig gelacht hast.' },
  { kind: 'action', text: 'Mach das Geräusch eines Tieres. Die Runde rät, welches.' },
  { kind: 'action', text: 'Beschreib deinen Tag heute mit genau fünf Wörtern.' },
  { kind: 'action', text: 'Öffne deine Kontakte und erzähl von dem Namen an dritter Stelle.', spicy: true },
  { kind: 'action', text: 'Erzähl von deinem schlimmsten Date. In drei Sätzen, keine Namen.', spicy: true },
  { kind: 'action', text: 'Nenn die Person am Tisch, die du bei einer Zombie-Apokalypse zuerst opfern würdest. Mit Begründung.', spicy: true },
  { kind: 'action', text: 'Sag ehrlich, was du beim ersten Eindruck über die Person rechts gedacht hast.', spicy: true },
  { kind: 'action', text: 'Erzähl, welche Nachricht du am längsten nicht beantwortet hast und warum.', spicy: true },
  { kind: 'action', text: 'Nenn eine Sache, die du getan hast und die niemand hier vermuten würde.', spicy: true },
  { kind: 'action', text: 'Erzähl von dem peinlichsten Spitznamen, den du je hattest.', spicy: true },
  { kind: 'action', text: 'Sag, wen du in diesem Raum bei einer Prüfung abschreiben lassen würdest – und wen nie.', spicy: true },
];
