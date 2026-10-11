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
 * Nine-hole rounds, rounds a player left early and scrambles (one shared
 * ball) are left out so totals stay comparable.
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

// ---------------------------------------------------------------------------
// Hole scores. A hole is a hole: every recorded score counts here, including
// scrambles, nine-hole rounds and the holes someone played before leaving early.
// ---------------------------------------------------------------------------

/** Each recorded hole score in a round for one player, mapped to the course's real hole index. */
function recordedHoles(round: Round, course: Course, playerId: string): { holeIndex: number; strokes: number }[] {
  const strokes = round.scores[playerId];
  if (!strokes) return [];
  const idx = holeIndexes(course, round.holes);
  const out: { holeIndex: number; strokes: number }[] = [];
  strokes.forEach((s, k) => {
    if (Number.isFinite(s) && s > 0 && idx[k] !== undefined) out.push({ holeIndex: idx[k], strokes: s });
  });
  return out;
}

/** A player's lifetime birdie/par/bogey counts across every recorded hole. */
export function playerHoleCounts(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): HoleCounts {
  const counts = emptyHoleCounts();
  for (const round of rounds) {
    const course = coursesById.get(round.courseId);
    if (!course) continue;
    for (const { holeIndex, strokes } of recordedHoles(round, course, playerId)) {
      tallyHole(strokes, course.holes[holeIndex].par, counts);
    }
  }
  return counts;
}

/** A single player's hole-score counts at each course, grouped by course id. */
export function playerHoleCountsByCourse(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): Map<string, HoleCounts> {
  const byCourse = new Map<string, HoleCounts>();
  for (const round of rounds) {
    const course = coursesById.get(round.courseId);
    if (!course) continue;
    const holes = recordedHoles(round, course, playerId);
    if (holes.length === 0) continue;
    const counts = byCourse.get(round.courseId) ?? emptyHoleCounts();
    for (const { holeIndex, strokes } of holes) tallyHole(strokes, course.holes[holeIndex].par, counts);
    byCourse.set(round.courseId, counts);
  }
  return byCourse;
}

// ---------------------------------------------------------------------------
// Course page: hole averages, difficulty rank, records
// ---------------------------------------------------------------------------

export interface HoleStat {
  holeNumber: number;
  par: number;
  /** Average strokes across every recorded score on this hole, or null if nobody has played it. */
  average: number | null;
  /** Average strokes over par (negative = under par). */
  avgOverPar: number | null;
  entries: number;
  /** 1 = hardest hole (highest average over par); null with no scores yet. */
  difficultyRank: number | null;
}

/**
 * Every hole's scoring average at a course across all players and rounds,
 * plus a 1..N difficulty ranking from that average over par (a par 5 and a
 * par 3 compare fairly). Ties go to the hole with the lower printed stroke
 * index, i.e. the one the scorecard already calls harder.
 */
export function courseHoleStats(course: Course, rounds: Round[]): HoleStat[] {
  const sums = course.holes.map(() => ({ strokes: 0, over: 0, n: 0 }));
  for (const round of rounds) {
    if (round.courseId !== course.id) continue;
    for (const playerId of round.playerIds) {
      for (const { holeIndex, strokes } of recordedHoles(round, course, playerId)) {
        sums[holeIndex].strokes += strokes;
        sums[holeIndex].over += strokes - course.holes[holeIndex].par;
        sums[holeIndex].n += 1;
      }
    }
  }
  const stats = course.holes.map((h, i): HoleStat => ({
    holeNumber: h.number,
    par: h.par,
    average: sums[i].n ? Math.round((sums[i].strokes / sums[i].n) * 100) / 100 : null,
    avgOverPar: sums[i].n ? Math.round((sums[i].over / sums[i].n) * 100) / 100 : null,
    entries: sums[i].n,
    difficultyRank: null,
  }));
  stats
    .map((s, i) => ({ s, si: course.holes[i].strokeIndex }))
    .filter(({ s }) => s.avgOverPar !== null)
    .sort((a, b) => (b.s.avgOverPar as number) - (a.s.avgOverPar as number) || a.si - b.si)
    .forEach(({ s }, rank) => {
      s.difficultyRank = rank + 1;
    });
  return stats;
}

export interface CourseScoreEntry {
  playerId: string;
  roundId: string;
  date: string;
  total: number;
}

/**
 * The best (lowest) complete 18-hole rounds ever recorded at a course,
 * across every player, best first. Excludes scrambles, nine-hole rounds
 * and rounds a player left early.
 */
export function courseTopScores(course: Course, rounds: Round[], limit = 5): CourseScoreEntry[] {
  const entries: CourseScoreEntry[] = [];
  for (const round of rounds) {
    if (round.courseId !== course.id || round.holes !== "all" || !isIndividuallyScored(round)) continue;
    for (const playerId of round.playerIds) {
      const strokes = round.scores[playerId];
      if (!isComplete(strokes, course.holes.length)) continue;
      entries.push({ playerId, roundId: round.id, date: round.date, total: totalScore(strokes) });
    }
  }
  return entries.sort((a, b) => a.total - b.total).slice(0, limit);
}

export interface CourseRelStat {
  courseId: string;
  avgRelToPar: number;
  roundsPlayed: number;
}

/**
 * A player's average score relative to par at each course they've played,
 * best (most negative) first. Counts complete rounds of any length and
 * rounds left early (measured over the holes actually played); scrambles
 * are excluded since the score is the team's.
 */
export function playerCourseRelToPar(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): CourseRelStat[] {
  const byCourse = new Map<string, { sum: number; count: number }>();
  for (const round of rounds) {
    if (!isIndividuallyScored(round)) continue;
    const course = coursesById.get(round.courseId);
    const strokes = round.scores[playerId];
    if (!course || !strokes || strokes.length === 0) continue;
    if (strokes.some((s) => !Number.isFinite(s) || s <= 0)) continue;
    const par = playedHoles(course, round.holes)
      .slice(0, strokes.length)
      .reduce((s, h) => s + h.par, 0);
    const entry = byCourse.get(round.courseId) ?? { sum: 0, count: 0 };
    entry.sum += totalScore(strokes) - par;
    entry.count += 1;
    byCourse.set(round.courseId, entry);
  }
  return [...byCourse.entries()]
    .map(([courseId, { sum, count }]) => ({
      courseId,
      avgRelToPar: Math.round((sum / count) * 10) / 10,
      roundsPlayed: count,
    }))
    .sort((a, b) => a.avgRelToPar - b.avgRelToPar);
}

export interface HoleRelStat {
  courseId: string;
  holeNumber: number;
  par: number;
  avgRelToPar: number;
  roundsPlayed: number;
}

/**
 * A hole needs at least this many recorded scores before it can count as a
 * player's best or worst hole at a course -- otherwise one lucky (or
 * unlucky) swing on an otherwise-unplayed hole would win the title.
 */
export const MIN_ROUNDS_FOR_HOLE_SUPERLATIVE = 2;

function holeAggregates(playerId: string, rounds: Round[], coursesById: Map<string, Course>): HoleRelStat[] {
  const byHole = new Map<string, { courseId: string; holeIndex: number; sum: number; count: number }>();
  for (const round of rounds) {
    const course = coursesById.get(round.courseId);
    if (!course) continue;
    for (const { holeIndex, strokes } of recordedHoles(round, course, playerId)) {
      const key = `${round.courseId}#${holeIndex}`;
      const entry = byHole.get(key) ?? { courseId: round.courseId, holeIndex, sum: 0, count: 0 };
      entry.sum += strokes - course.holes[holeIndex].par;
      entry.count += 1;
      byHole.set(key, entry);
    }
  }
  const out: HoleRelStat[] = [];
  for (const { courseId, holeIndex, sum, count } of byHole.values()) {
    if (count < MIN_ROUNDS_FOR_HOLE_SUPERLATIVE) continue;
    const hole = coursesById.get(courseId)!.holes[holeIndex];
    out.push({
      courseId,
      holeNumber: hole.number,
      par: hole.par,
      avgRelToPar: Math.round((sum / count) * 10) / 10,
      roundsPlayed: count,
    });
  }
  return out;
}

function pickPerCourse(
  stats: HoleRelStat[],
  isBetter: (candidate: HoleRelStat, current: HoleRelStat) => boolean,
): Map<string, HoleRelStat> {
  const picked = new Map<string, HoleRelStat>();
  for (const s of stats) {
    const current = picked.get(s.courseId);
    if (!current || isBetter(s, current)) picked.set(s.courseId, s);
  }
  return picked;
}

/**
 * For each course a player has played, the hole they score best on (lowest
 * average relative to par). Only holes with 2+ recorded scores qualify;
 * ties go to the higher-par hole, the more impressive result.
 */
export function playerBestHolesByCourse(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): Map<string, HoleRelStat> {
  return pickPerCourse(
    holeAggregates(playerId, rounds, coursesById),
    (c, cur) => c.avgRelToPar < cur.avgRelToPar || (c.avgRelToPar === cur.avgRelToPar && c.par > cur.par),
  );
}

/** Same, but the hole they score worst on. */
export function playerWorstHolesByCourse(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): Map<string, HoleRelStat> {
  return pickPerCourse(
    holeAggregates(playerId, rounds, coursesById),
    (c, cur) => c.avgRelToPar > cur.avgRelToPar || (c.avgRelToPar === cur.avgRelToPar && c.par > cur.par),
  );
}

export interface PlayerHoleStat {
  holeNumber: number;
  par: number;
  plays: number;
  average: number | null;
  best: number | null;
  worst: number | null;
  /** Average strokes over par on this hole (negative = under par). */
  avgRelToPar: number | null;
}

/** One player's results on every hole of a course: plays, average, best, worst, and average vs par. */
export function playerHoleStats(playerId: string, course: Course, rounds: Round[]): PlayerHoleStat[] {
  const acc = course.holes.map(() => ({ sum: 0, n: 0, best: Infinity, worst: 0 }));
  for (const round of rounds) {
    if (round.courseId !== course.id) continue;
    for (const { holeIndex, strokes } of recordedHoles(round, course, playerId)) {
      const a = acc[holeIndex];
      a.sum += strokes;
      a.n += 1;
      a.best = Math.min(a.best, strokes);
      a.worst = Math.max(a.worst, strokes);
    }
  }
  return course.holes.map((h, i) => {
    const a = acc[i];
    return {
      holeNumber: h.number,
      par: h.par,
      plays: a.n,
      average: a.n ? Math.round((a.sum / a.n) * 10) / 10 : null,
      best: a.n ? a.best : null,
      worst: a.n ? a.worst : null,
      avgRelToPar: a.n ? Math.round((a.sum / a.n - h.par) * 10) / 10 : null,
    };
  });
}
