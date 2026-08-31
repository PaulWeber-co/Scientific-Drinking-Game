import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { FullLayout, Layout } from './Layout';
import { Onboarding } from '../features/onboarding/Onboarding';
import { Home } from '../features/home/Home';
import { GameDetail, GamesScreen } from '../features/games/GamesScreen';
import { LobbyScreen } from '../features/lobby/LobbyScreen';
import { PegelScreen } from '../features/bac/PegelScreen';
import { ProfileScreen } from '../features/settings/ProfileScreen';
import { PartyScreen } from '../features/party/PartyScreen';
import { usePlayer } from '../store/player';
import { useParty } from '../features/party/PartyContext';

export function Router() {
  const onboarded = usePlayer((s) => s.onboarded);
  const location = useLocation();

  if (!onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <Routes>
      <Route element={<FullLayout />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/spiel" element={<PartyScreen />} />
      </Route>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/spiele" element={<GamesScreen />} />
        <Route path="/spiele/:id" element={<GameDetail />} />
        <Route path="/lobby" element={<LobbyWithInvite />} />
        <Route path="/pegel" element={<PegelScreen />} />
        <Route path="/profil" element={<ProfileScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Nimmt ?code=XXXX aus einem geteilten Einladungslink entgegen. */
function LobbyWithInvite() {
  const [params, setParams] = useSearchParams();
  const party = useParty();
  const invite = params.get('code');

  useEffect(() => {
    if (!invite || party.code) return;
    party.joinOnline(invite).catch(() => {});
    setParams({}, { replace: true });
  }, [invite, party, setParams]);

  return <LobbyScreen />;
}
