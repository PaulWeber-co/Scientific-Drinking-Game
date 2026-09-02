import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Router } from '../app/Router';
import { PartyCtx, type PartyValue } from '../features/party/PartyContext';
import { usePlayer } from '../store/player';
import { useApp } from '../store/app';
import { LEGAL, hasPlaceholders } from './site';
import type { GamePlayer } from '../games/types';

const me: GamePlayer = { id: 'me', name: 'Paul', color: 'blue', online: true };

const party = (): PartyValue =>
  ({
    mode: 'local',
    code: null,
    status: 'lobby',
    connection: 'idle',
    error: null,
    players: [me],
    me,
    isHost: true,
    gameId: null,
    gameState: null,
    startedBy: null,
    startedAt: 0,
    createOnline: async () => '',
    joinOnline: async () => {},
    startLocal: () => {},
    leave: () => {},
    addLocalPlayer: () => {},
    updateLocalPlayer: () => {},
    removeLocalPlayer: () => {},
    startGame: () => {},
    endGame: () => {},
    dispatch: () => {},
    logSipsFor: () => {},
  }) as unknown as PartyValue;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PartyCtx.Provider value={party()}>
        <Router />
      </PartyCtx.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // Frisches Gerät: noch kein Onboarding abgeschlossen.
  usePlayer.setState({ profile: null, onboarded: false, log: [] });
  useApp.setState({ disclaimerAccepted: true });
});

describe('Rechtstexte', () => {
  it('sind ohne abgeschlossenes Onboarding erreichbar', () => {
    // Das ist die eigentliche Anforderung: ein Impressum hinter einer
    // Registrierungshürde gilt als nicht unmittelbar erreichbar.
    renderAt('/impressum');
    expect(screen.getByRole('heading', { name: /Angaben nach § 5 DDG/i })).toBeInTheDocument();

    renderAt('/datenschutz');
    expect(screen.getByRole('heading', { name: /Verantwortlicher/i })).toBeInTheDocument();
  });

  it('leitet andere Seiten ohne Onboarding weiter', () => {
    // Gegenprobe: die Ausnahme gilt wirklich nur für die beiden Rechtsseiten.
    renderAt('/pegel');
    expect(screen.queryByRole('heading', { name: /Angaben nach § 5 DDG/i })).toBeNull();
    expect(screen.getByText(/Trinkspiele/i)).toBeInTheDocument();
  });

  it('verlinken sich schon auf dem ersten Bildschirm', () => {
    renderAt('/onboarding');
    // Der Link muss wörtlich "Impressum" heißen – "Kontakt" oder "Info" genügt nicht.
    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute(
      'href',
      '/impressum',
    );
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toBeInTheDocument();
  });

  it('warnen sichtbar, solange Platzhalter drinstehen', () => {
    renderAt('/impressum');
    if (hasPlaceholders()) {
      expect(screen.getByText(/Noch nicht ausgefüllt/)).toBeInTheDocument();
    } else {
      expect(screen.queryByText(/Noch nicht ausgefüllt/)).toBeNull();
    }
  });

  it('nennen jeden Dienst vollständig', () => {
    for (const p of [LEGAL.hosting, ...LEGAL.processors]) {
      for (const [field, value] of Object.entries(p)) {
        if (field === 'thirdCountry') continue;
        expect(String(value).length, `${p.label}: ${field}`).toBeGreaterThan(3);
      }
      expect(() => new URL(p.privacyUrl), p.label).not.toThrow();
    }
  });

  it('verlinken die abgeschaltete EU-Streitbeilegungsplattform nicht mehr', () => {
    // Die OS-Plattform wurde im Juli 2025 eingestellt. Ein toter Pflichtlink
    // im Impressum ist schlechter als gar keiner.
    renderAt('/impressum');
    expect(document.body.innerHTML).not.toMatch(/consumers\/odr|ec\.europa\.eu\/odr/);
  });
});
