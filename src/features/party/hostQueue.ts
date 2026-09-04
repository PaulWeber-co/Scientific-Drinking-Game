/**
 * Reiht Host-Schreibvorgänge nacheinander auf. Der Host ist die einzige
 * Instanz, die den Spielstand schreibt – und zwei Läufe, die denselben
 * Stand lesen und nacheinander schreiben, würden sich gegenseitig
 * überschreiben. Also: erst wenn ein Lauf fertig ist, liest der nächste.
 * Ein fehlgeschlagener Lauf blockiert die folgenden nicht.
 */
export function createQueue(): (job: () => Promise<void> | void) => Promise<void> {
  let tail: Promise<void> = Promise.resolve();
  return (job) => {
    const run = tail.then(job).catch((e) => console.error('Host-Aktion fehlgeschlagen', e));
    tail = run;
    return run;
  };
}
