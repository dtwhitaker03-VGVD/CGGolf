import type { Course, Hole, PlayerSetup, Round, RoundHoles, Tee } from "../types";

// ---------------------------------------------------------------------------
// Which holes a round covers
// ---------------------------------------------------------------------------

/** Indexes (into course.holes) of the holes played in a round. */
export function holeIndexes(course: Course, which: RoundHoles): number[] {
  const all = course.holes.map((_, i) => i);
  if (which === "all" || course.holes.length <= 9) return all;
  return which === "front" ? all.slice(0, 9) : all.slice(9);
}

export function playedHoles(course: Course, which: RoundHoles): Hole[] {
  return holeIndexes(course, which).map((i) => course.holes[i]);
}

export function roundHolesLabel(which: RoundHoles): string {
  return which === "all" ? "18 holes" : which === "front" ? "Front 9" : "Back 9";
}

export function coursePar(course: Course, which: RoundHoles = "all"): number {
  return playedHoles(course, which).reduce((s, h) => s + h.par, 0);
}

export function totalScore(strokes: number[]): number {
  return strokes.reduce((sum, s) => sum + (Number.isFinite(s) ? s : 0), 0);
}

export function teeYards(tee: Tee, course: Course, which: RoundHoles = "all"): number {
  return holeIndexes(course, which).reduce((s, i) => s + (tee.yards[i] ?? 0), 0);
}

export function findTee(course: Course, name: string): Tee | undefined {
  return course.tees.find((t) => t.name === name);
}

// ---------------------------------------------------------------------------
// Course / playing handicap and stroke allocation
// ---------------------------------------------------------------------------

/**
 * USGA course handicap: index x (slope / 113) + (course rating - par).
 * Falls back to the plain slope-adjusted index when the tee has no
 * rating/slope.
 */
export function courseHandicap(index: number, tee: Tee, par: number): number {
  if (tee.rating === undefined || tee.slope === undefined) return Math.round(index);
  return Math.round(index * (tee.slope / 113) + (tee.rating - par));
}

/**
 * Playing handicap (strokes received) for the holes in a round. Nine-hole
 * rounds get half of the 18-hole course handicap.
 */
export function playingHandicap(index: number, tee: Tee, course: Course, which: RoundHoles): number {
  const full = courseHandicap(index, tee, coursePar(course, "all"));
  return which === "all" || course.holes.length <= 9 ? full : Math.round(full / 2);
}

/**
 * Strokes a player receives on each hole played (same order as the holes).
 * Strokes go to the hardest holes first by stroke index; for a nine-hole
 * round the indexes are re-ranked among just those nine holes. A negative
 * (plus) handicap gives strokes back on the easiest holes.
 */
export function strokesReceived(
  playing: number | null,
  holes: Hole[],
  useWomenIndex = false,
): number[] {
  if (playing === null) return holes.map(() => 0);
  const si = holes.map((h) => (useWomenIndex && h.strokeIndexW ? h.strokeIndexW : h.strokeIndex));
  const ranked = [...si].sort((a, b) => a - b);
  const rank = si.map((v) => ranked.indexOf(v) + 1); // 1..n among holes played
  const n = holes.length;
  if (playing >= 0) {
    const base = Math.floor(playing / n);
    const rem = playing % n;
    return rank.map((r) => base + (r <= rem ? 1 : 0));
  }
  const giveBack = Math.min(n, -playing);
  return rank.map((r) => (r > n - giveBack ? -1 : 0));
}

export function setupStrokes(course: Course, which: RoundHoles, setup: PlayerSetup): number[] {
  return strokesReceived(setup.playingHandicap, playedHoles(course, which), setup.useWomenIndex);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function netScore(gross: number[], received: number[]): number {
  return totalScore(gross) - received.reduce((s, v) => s + v, 0);
}

/** Stableford points for one hole: net par = 2, birdie = 3, bogey = 1, double+ = 0. */
export function stablefordPoints(gross: number, par: number, received: number): number {
  return Math.max(0, 2 + par - (gross - received));
}

export function stablefordTotal(gross: number[], holes: Hole[], received: number[]): number {
  return gross.reduce((s, g, i) => (holes[i] ? s + stablefordPoints(g, holes[i].par, received[i] ?? 0) : s), 0);
}

export interface PlayerResult {
  playerId: string;
  /** Holes with a score (fewer than the round's holes if the player left early). */
  holes: number;
  gross: number;
  net: number;
  stableford: number;
  vsPar: number;
  complete: boolean;
}

/**
 * Gross/net/Stableford totals for one player in a round, over the holes they
 * actually played. `complete` = every hole of the round has a score.
 */
export function playerResult(round: Round, course: Course, playerId: string): PlayerResult | null {
  const gross = round.scores[playerId];
  const setup = round.setups[playerId];
  if (!gross || !setup) return null;
  const holes = playedHoles(course, round.holes);
  const received = setupStrokes(course, round.holes, setup);
  const played = holes.slice(0, gross.length);
  return {
    playerId,
    holes: gross.length,
    gross: totalScore(gross),
    net: totalScore(gross) - received.slice(0, gross.length).reduce((s, v) => s + v, 0),
    stableford: stablefordTotal(gross, played, received),
    vsPar: totalScore(gross) - played.reduce((s, h) => s + h.par, 0),
    complete: gross.length === holes.length && gross.every((s) => Number.isFinite(s) && s > 0),
  };
}

export function formatVsPar(n: number): string {
  return n === 0 ? "E" : n > 0 ? `+${n}` : String(n);
}

// ---------------------------------------------------------------------------
// Handicap index (modeled on the World Handicap System)
// ---------------------------------------------------------------------------

export interface Differential {
  roundId: string;
  date: string;
  courseId: string;
  value: number;
}

/**
 * Adjusted gross score: each hole is capped at net double bogey
 * (par + 2 + strokes received). Players with no handicap yet use par + 5.
 */
export function adjustedGross(gross: number[], holes: Hole[], received: number[], hasHandicap: boolean): number {
  return gross.reduce((sum, g, i) => {
    const hole = holes[i];
    if (!hole) return sum + g;
    const cap = hasHandicap ? hole.par + 2 + (received[i] ?? 0) : hole.par + 5;
    return sum + Math.min(g, cap);
  }, 0);
}

/** Score differential: (adjusted gross - course rating) x 113 / slope, to 0.1. */
export function scoreDifferential(ags: number, rating: number, slope: number): number {
  return Math.round(((ags - rating) * 113) / slope * 10) / 10;
}

/** [number of lowest differentials to average, adjustment] by rounds on record (WHS table). */
function indexRule(n: number): [number, number] | null {
  if (n < 3) return null;
  if (n === 3) return [1, -2];
  if (n === 4) return [1, -1];
  if (n === 5) return [1, 0];
  if (n === 6) return [2, -1];
  if (n <= 8) return [2, 0];
  if (n <= 11) return [3, 0];
  if (n <= 14) return [4, 0];
  if (n <= 16) return [5, 0];
  if (n <= 18) return [6, 0];
  if (n === 19) return [7, 0];
  return [8, 0];
}

export const MAX_HANDICAP_INDEX = 54;

/**
 * Handicap index from a player's score differentials: the average of the
 * lowest ones among the most recent 20, per the WHS table. Null with fewer
 * than 3 rounds.
 */
export function computeHandicapIndex(differentials: Differential[]): number | null {
  const recent = [...differentials]
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
    .slice(0, 20);
  const rule = indexRule(recent.length);
  if (!rule) return null;
  const [count, adjustment] = rule;
  const best = [...recent].sort((a, b) => a.value - b.value).slice(0, count);
  const avg = best.reduce((s, d) => s + d.value, 0) / best.length;
  const index = Math.round((avg + adjustment) * 10) / 10;
  return Math.min(index, MAX_HANDICAP_INDEX);
}

/**
 * A player's score differentials: only complete 18-hole rounds from a tee
 * that has both a rating and a slope count.
 */
export function playerDifferentials(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): Differential[] {
  const out: Differential[] = [];
  for (const round of rounds) {
    if (round.holes !== "all") continue;
    // A scramble is one shared ball, so it says nothing about this player's own game.
    if (round.mode === "team" && round.teamGameType === "scramble") continue;
    const course = coursesById.get(round.courseId);
    const setup = round.setups[playerId];
    const gross = round.scores[playerId];
    if (!course || !setup || !gross) continue;
    if (setup.rating === undefined || setup.slope === undefined) continue;
    const holes = playedHoles(course, round.holes);
    if (gross.length !== holes.length || gross.some((s) => !Number.isFinite(s) || s <= 0)) continue;
    const received = setupStrokes(course, round.holes, setup);
    const ags = adjustedGross(gross, holes, received, setup.playingHandicap !== null);
    out.push({
      roundId: round.id,
      date: round.date,
      courseId: round.courseId,
      value: scoreDifferential(ags, setup.rating, setup.slope),
    });
  }
  return out;
}

export function formatIndex(index: number | null | undefined): string {
  if (index === null || index === undefined) return "—";
  return index < 0 ? `+${Math.abs(index).toFixed(1)}` : index.toFixed(1);
}

/**
 * The index to use for a player right now: the calculated one if they have
 * enough rounds, otherwise their manually entered starting index (if any).
 */
export function effectiveIndex(
  calculated: number | null,
  startingIndex: number | undefined,
): number | null {
  return calculated ?? startingIndex ?? null;
}

// ---------------------------------------------------------------------------
// Per-hole result classification
// ---------------------------------------------------------------------------

export interface HoleCounts {
  holesPlayed: number;
  aces: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  triplePlus: number;
}

export function emptyHoleCounts(): HoleCounts {
  return { holesPlayed: 0, aces: 0, eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubleBogeys: 0, triplePlus: 0 };
}

export function tallyHole(strokes: number, par: number, counts: HoleCounts): void {
  counts.holesPlayed += 1;
  if (strokes === 1) {
    counts.aces += 1;
    return;
  }
  const diff = strokes - par;
  if (diff <= -2) counts.eagles += 1;
  else if (diff === -1) counts.birdies += 1;
  else if (diff === 0) counts.pars += 1;
  else if (diff === 1) counts.bogeys += 1;
  else if (diff === 2) counts.doubleBogeys += 1;
  else counts.triplePlus += 1;
}
