import type { Course, Round } from "../types";
import {
  emptyHoleCounts,
  holeIndexes,
  playedHoles,
  tallyHole,
  totalScore,
  type HoleCounts,
} from "./golf";
import { isIndividuallyScored } from "./rounds";

export interface ScoreStats {
  rounds: number;
  low: number;
  high: number;
  average: number;
}

function isComplete(strokes: number[] | undefined, expected: number): strokes is number[] {
  return !!strokes && strokes.length === expected && strokes.every((s) => Number.isFinite(s) && s > 0);
}

export function computeScoreStats(totals: number[]): ScoreStats | null {
  if (totals.length === 0) return null;
  const sum = totals.reduce((s, v) => s + v, 0);
  return {
    rounds: totals.length,
    low: Math.min(...totals),
    high: Math.max(...totals),
    average: Math.round((sum / totals.length) * 10) / 10,
  };
}

/**
 * Gross totals for complete 18-hole rounds at a course, grouped by player.
 * (Nine-hole rounds are left out so totals stay comparable.)
 */
export function courseTotalsByPlayer(
  course: Course,
  rounds: Round[],
): Map<string, number[]> {
  const byPlayer = new Map<string, number[]>();
  for (const round of rounds) {
    if (round.courseId !== course.id || round.holes !== "all" || !isIndividuallyScored(round)) continue;
    for (const playerId of round.playerIds) {
      const strokes = round.scores[playerId];
      if (!isComplete(strokes, course.holes.length)) continue;
      const list = byPlayer.get(playerId) ?? [];
      list.push(totalScore(strokes));
      byPlayer.set(playerId, list);
    }
  }
  return byPlayer;
}

/** A player's complete 18-hole gross totals at each course, grouped by course id. */
export function playerTotalsByCourse(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): Map<string, number[]> {
  const byCourse = new Map<string, number[]>();
  for (const round of rounds) {
    if (round.holes !== "all" || !isIndividuallyScored(round)) continue;
    const course = coursesById.get(round.courseId);
    const strokes = round.scores[playerId];
    if (!course || !isComplete(strokes, course.holes.length)) continue;
    const list = byCourse.get(round.courseId) ?? [];
    list.push(totalScore(strokes));
    byCourse.set(round.courseId, list);
  }
  return byCourse;
}

/** A player's lifetime birdie/par/bogey counts across every complete round. */
export function playerHoleCounts(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): HoleCounts {
  const counts = emptyHoleCounts();
  for (const round of rounds) {
    const course = coursesById.get(round.courseId);
    const strokes = round.scores[playerId];
    if (!course || !isIndividuallyScored(round)) continue;
    const holes = playedHoles(course, round.holes);
    if (!isComplete(strokes, holes.length)) continue;
    strokes.forEach((s, i) => tallyHole(s, holes[i].par, counts));
  }
  return counts;
}

export interface HoleDifficulty {
  holeNumber: number;
  par: number;
  played: number;
  /** Average strokes over par across all recorded scores on this hole. */
  avgOverPar: number;
}

/** How each hole of a course has played for the whole group, in hole order. */
export function holeDifficulty(course: Course, rounds: Round[]): HoleDifficulty[] {
  const sums = course.holes.map(() => ({ total: 0, n: 0 }));
  for (const round of rounds) {
    if (round.courseId !== course.id || !isIndividuallyScored(round)) continue;
    const idx = holeIndexes(course, round.holes);
    for (const playerId of round.playerIds) {
      const strokes = round.scores[playerId];
      if (!isComplete(strokes, idx.length)) continue;
      strokes.forEach((s, k) => {
        const hole = course.holes[idx[k]];
        sums[idx[k]].total += s - hole.par;
        sums[idx[k]].n += 1;
      });
    }
  }
  return course.holes.map((h, i) => ({
    holeNumber: h.number,
    par: h.par,
    played: sums[i].n,
    avgOverPar: sums[i].n === 0 ? 0 : Math.round((sums[i].total / sums[i].n) * 100) / 100,
  }));
}
