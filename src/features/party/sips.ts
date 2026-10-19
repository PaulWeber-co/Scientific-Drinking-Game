import { useMemo } from 'react';
import { findDrink } from '../../engine/drinks';
import { personalSips } from '../../engine/sips';
import type { SipResult } from '../../engine/types';
import type { GamePlayer } from '../../games/types';
import { useBacEvents, usePlayer } from '../../store/player';
import { useNow } from '../../lib/useNow';
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
  const log = useBacEvents();
  const currentDrinkId = usePlayer((s) => s.currentDrinkId);
  const customDrinks = usePlayer((s) => s.customDrinks);
  const now = useNow();

  return useMemo(() => {
    if (!player) return null;
    if (player.id === me.id) {
      if (!profile) return null;
      return personalSips({
        profile,
        drink: findDrink(currentDrinkId, customDrinks),
        events: log,
        baseSips,
        now,
      });
    }
    if (player.local) {
      return personalSips({
        profile: player.local.profile,
        // Dieselbe Getränkeliste wie beim Eintragen (`logSipsFor`): ein Gerät,
        // eine Liste eigener Getränke. Ohne sie rechnete die Ansage für ein
        // eigenes Getränk still mit dem ersten Katalog-Getränk (Pils).
        drink: findDrink(player.local.drinkId, customDrinks),
        events: [...(player.local.carryoverLog ?? []), ...player.local.log],
        baseSips,
        now,
      });
    }
    return null;
  }, [player, me.id, profile, log, currentDrinkId, customDrinks, baseSips, now]);
}

/** Schluckzahl für mich selbst. */
export function useMySips(baseSips: number): SipResult | null {
  const me = useParty().me;
  return useSipsForPlayer(me, baseSips);
}
