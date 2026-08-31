import { useMemo } from 'react';
import { findDrink } from '../../engine/drinks';
import { personalSips } from '../../engine/sips';
import type { SipResult } from '../../engine/types';
import type { GamePlayer } from '../../games/types';
import { usePlayer } from '../../store/player';
import { useParty } from './PartyContext';

/**
 * Schluckzahl für einen konkreten Spieler.
 *
 * Wichtig: Körperdaten verlassen nie das Gerät. Deshalb kann ein Gerät
 * nur rechnen für (a) sich selbst und (b) Pass-&-Play-Mitspieler, die auf
 * genau diesem Gerät angelegt wurden. Für alle anderen kommt `null` zurück
 * – die sehen ihre eigene Zahl auf ihrem eigenen Handy.
 */
export function useSipsForPlayer(player: GamePlayer | null, baseSips: number): SipResult | null {
  const me = useParty().me;
  const profile = usePlayer((s) => s.profile);
  const log = usePlayer((s) => s.log);
  const currentDrinkId = usePlayer((s) => s.currentDrinkId);
  const customDrinks = usePlayer((s) => s.customDrinks);

  return useMemo(() => {
    if (!player) return null;
    if (player.id === me.id) {
      if (!profile) return null;
      return personalSips({
        profile,
        drink: findDrink(currentDrinkId, customDrinks),
        events: log,
        baseSips,
      });
    }
    if (player.local) {
      return personalSips({
        profile: player.local.profile,
        drink: findDrink(player.local.drinkId),
        events: player.local.log,
        baseSips,
      });
    }
    return null;
  }, [player, me.id, profile, log, currentDrinkId, customDrinks, baseSips]);
}

/** Schluckzahl für mich selbst. */
export function useMySips(baseSips: number): SipResult | null {
  const me = useParty().me;
  return useSipsForPlayer(me, baseSips);
}
