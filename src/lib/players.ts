import type { Course, Player, Round } from "../types";
import { computeHandicapIndex, effectiveIndex, playerDifferentials } from "./golf";

export interface PlayerIndex {
  /** Index calculated from logged rounds, or null with fewer than 3 usable rounds. */
  calculated: number | null;
  /** Calculated index if available, otherwise the player's manual starting index. */
  current: number | null;
  /** True when `current` came from the manually entered starting index. */
  fromStarting: boolean;
  /** Number of rounds that counted toward the index. */
  rounds: number;
}

export function playerIndex(
  player: Player,
  rounds: Round[],
  coursesById: Map<string, Course>,
): PlayerIndex {
  const diffs = playerDifferentials(player.id, rounds, coursesById);
  const calculated = computeHandicapIndex(diffs);
  const current = effectiveIndex(calculated, player.startingIndex);
  return {
    calculated,
    current,
    fromStarting: calculated === null && current !== null,
    rounds: diffs.length,
  };
}
