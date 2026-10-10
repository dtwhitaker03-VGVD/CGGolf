export interface HoleWinCounts {
  holesWon: number;
  holesHalved: number;
}

/**
 * Match-play hole wins: for each hole index 0..holesCount-1, whichever
 * competitor has the strictly lowest score on that hole wins it; a tie
 * between the lowest scorers halves the hole (nobody wins it). A hole is
 * skipped entirely if no competitor has a recorded score for it.
 */
export function computeHoleWins(
  holesCount: number,
  competitors: { id: string; perHoleScores: (number | undefined)[] }[],
): Record<string, HoleWinCounts> {
  const results: Record<string, HoleWinCounts> = {};
  for (const c of competitors) results[c.id] = { holesWon: 0, holesHalved: 0 };

  for (let h = 0; h < holesCount; h++) {
    let lowest = Infinity;
    let winners: string[] = [];
    for (const c of competitors) {
      const s = c.perHoleScores[h];
      if (typeof s !== "number" || !Number.isFinite(s)) continue;
      if (s < lowest) {
        lowest = s;
        winners = [c.id];
      } else if (s === lowest) {
        winners.push(c.id);
      }
    }
    if (winners.length === 1) {
      results[winners[0]].holesWon += 1;
    } else if (winners.length > 1) {
      for (const id of winners) results[id].holesHalved += 1;
    }
  }
  return results;
}

/**
 * A team's per-hole score from its members' per-hole scores: the shared value
 * for scramble, the lowest teammate for best ball, or the sum of teammates
 * for team total. Undefined for a hole where not every needed score is in.
 */
export function teamPerHoleScores(
  gameType: "scramble" | "bestBall" | "teamTotal",
  memberIds: string[],
  scores: Record<string, (number | undefined)[] | undefined>,
  holesCount: number,
): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  for (let h = 0; h < holesCount; h++) {
    if (gameType === "scramble") {
      result.push(scores[memberIds[0]]?.[h]);
      continue;
    }
    const holeScores = memberIds
      .map((pid) => scores[pid]?.[h])
      .filter((v): v is number => typeof v === "number");
    if (gameType === "bestBall") {
      result.push(holeScores.length > 0 ? Math.min(...holeScores) : undefined);
    } else {
      result.push(
        holeScores.length === memberIds.length ? holeScores.reduce((s, v) => s + v, 0) : undefined,
      );
    }
  }
  return result;
}
