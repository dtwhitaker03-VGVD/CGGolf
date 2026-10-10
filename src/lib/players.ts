import type { Course, Player, Round } from "../types";
import { computeHandicapIndex, playerDifferentials } from "./golf";

export interface PlayerIndex {
  /** Index calculated from logged rounds, or null with fewer than 3 usable rounds. */
  calculated: number | null;
  current: number | null;
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
  return {
    calculated,
    current: calculated,
    rounds: diffs.length,
  };
}
