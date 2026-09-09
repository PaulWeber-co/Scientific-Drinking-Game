import { useEffect } from 'react';
import { useParty } from '../party/PartyContext';
import { usePlayer } from '../../store/player';
import { useNights } from '../../store/nights';
import { useApp } from '../../store/app';

/**
 * Hält den laufenden Abend nach – rendert nichts.
 *
 * Zwei Aufgaben, die nur hier zusammenkommen: Die Stores kennen die Runde
 * nicht, und die Runde kennt die Stores nicht. Deshalb sitzt die Brücke in
 * einer eigenen Komponente direkt unter dem Provider statt in einem Layout;
 * ein laufendes Spiel rendert im Vollbild ohne Tab-Leiste, und genau dort
 * darf das Mitschreiben nicht aussetzen.
 */
export function NightTracker() {
  const { players, status } = useParty();
  const nightStartedAt = usePlayer((s) => s.nightStartedAt);
  const beginNight = usePlayer((s) => s.beginNight);
  const noteParticipants = useNights((s) => s.noteParticipants);
  const clearSpicy = useApp((s) => s.clearSpicy);

  // Ein startendes Spiel eröffnet den Abend genauso wie das erste Getränk.
  // Ohne das hätte ein alkoholfreier Abend keinen Beginn – und damit keinen
  // Rückblick.
  // `nightStartedAt` gehört in die Abhängigkeiten: wird der Abend im
  // Pegel-Tab abgeschlossen, während ein Spiel läuft, bliebe `status` sonst
  // unverändert 'playing' und es gäbe bis zum nächsten Getränk keinen
  // laufenden Abend — und damit keine Teilnehmer.
  useEffect(() => {
    if (status === 'playing') beginNight();
  }, [status, nightStartedAt, beginNight]);

  // Spicy ist eine Einwilligung der Runde, keine Vorliebe – es gilt nur für
  // den Abend, an dem es eingeschaltet wurde. Zurückgesetzt wird aber erst,
  // wenn auch kein Spiel mehr läuft: Wer im Pegel-Tab den Abend abschließt
  // und weiterspielt, verlöre sonst mitten in der Runde still die Karten.
  useEffect(() => {
    if (!nightStartedAt && status !== 'playing') clearSpicy();
  }, [nightStartedAt, status, clearSpicy]);

  // Teilnehmer werden gesammelt, solange der Abend läuft: wer zwischendurch
  // geht, war trotzdem dabei und bleibt in der Liste.
  useEffect(() => {
    if (!nightStartedAt) return;
    noteParticipants(players.map((p) => ({ id: p.id, name: p.name, color: p.color })));
  }, [players, nightStartedAt, noteParticipants]);

  return null;
}
