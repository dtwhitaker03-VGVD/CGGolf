import type { Course, Player, Round, Tee } from "../types";
import { findTee, holeIndexes, playedHoles, playingHandicap, strokesReceived, totalScore } from "./golf";
import { isIndividuallyScored } from "./rounds";
import { playerIndex } from "./players";

export interface Record3 {
  w: number;
  l: number;
  t: number;
}

const rec = (): Record3 => ({ w: 0, l: 0, t: 0 });
function tally(r: Record3, mine: number, theirs: number) {
  if (mine < theirs) r.w += 1;
  else if (mine > theirs) r.l += 1;
  else r.t += 1;
}

/**
 * Strokes a player would receive on each hole of a round if it had been played
 * with handicaps, using their current index. Null when they have no index yet.
 */
export function hypotheticalReceived(
  index: number | null,
  round: Round,
  course: Course,
  playerId: string,
): number[] | null {
  if (index === null) return null;
  const setup = round.setups[playerId];
  const base: Tee | undefined = (setup && findTee(course, setup.tee)) ?? course.tees[0];
  if (!base) return null;
  const tee: Tee = {
    ...base,
    rating: setup?.rating ?? base.rating,
    slope: setup?.slope ?? base.slope,
  };
  const playing = playingHandicap(index, tee, course, round.holes);
  return strokesReceived(playing, playedHoles(course, round.holes), setup?.useWomenIndex ?? tee.useWomenIndex);
}

export interface HeadToHead {
  opponentId: string;
  /** Rounds where both finished the same holes. */
  rounds: number;
  straight: Record3;
  /** Null when either player has no handicap index yet. */
  handicap: Record3 | null;
  holesStraight: Record3;
  holesHandicap: Record3 | null;
}

/** One player's record against every other player they've shared a round with. */
export function headToHeadRecords(
  me: Player,
  players: Player[],
  rounds: Round[],
  coursesById: Map<string, Course>,
): HeadToHead[] {
  const idx = new Map(players.map((p) => [p.id, playerIndex(p, rounds, coursesById).current]));
  const out: HeadToHead[] = [];
  for (const opp of players) {
    if (opp.id === me.id) continue;
    const row: HeadToHead = {
      opponentId: opp.id,
      rounds: 0,
      straight: rec(),
      handicap: idx.get(me.id) != null && idx.get(opp.id) != null ? rec() : null,
      holesStraight: rec(),
      holesHandicap: idx.get(me.id) != null && idx.get(opp.id) != null ? rec() : null,
    };
    for (const round of rounds) {
      if (!isIndividuallyScored(round)) continue;
      const course = coursesById.get(round.courseId);
      const a = round.scores[me.id];
      const b = round.scores[opp.id];
      if (!course || !a || !b) continue;
      const n = Math.min(a.length, b.length);
      if (n === 0) continue;
      const rA = hypotheticalReceived(idx.get(me.id) ?? null, round, course, me.id);
      const rB = hypotheticalReceived(idx.get(opp.id) ?? null, round, course, opp.id);
      for (let i = 0; i < n; i++) {
        if (!(a[i] > 0) || !(b[i] > 0)) continue;
        tally(row.holesStraight, a[i], b[i]);
        if (row.holesHandicap && rA && rB) tally(row.holesHandicap, a[i] - (rA[i] ?? 0), b[i] - (rB[i] ?? 0));
      }
      if (n !== holeIndexes(course, round.holes).length) continue; // round totals need both to finish
      const ga = a.slice(0, n);
      const gb = b.slice(0, n);
      row.rounds += 1;
      tally(row.straight, totalScore(ga), totalScore(gb));
      if (row.handicap && rA && rB) {
        const sum = (arr: number[]) => arr.slice(0, n).reduce((s, v) => s + v, 0);
        tally(row.handicap, totalScore(ga) - sum(rA), totalScore(gb) - sum(rB));
      }
    }
    if (row.rounds > 0 || row.holesStraight.w + row.holesStraight.l + row.holesStraight.t > 0) out.push(row);
  }
  return out.sort((x, y) => y.rounds - x.rounds);
}

export interface NetStats {
  rounds: number;
  bestNet: number;
  bestRoundId: string;
  bestCourseId: string;
  bestDate: string;
  avgNet: number;
  avgGross: number;
  /** Rounds where the net score was under par. */
  beatPar: number;
}

/**
 * Net stats from complete 18-hole individual rounds, with strokes from the
 * player's current index (the same "if we'd played handicap" assumption as
 * head-to-head). Null with no index or no eligible rounds.
 */
export function playerNetStats(
  player: Player,
  rounds: Round[],
  coursesById: Map<string, Course>,
): NetStats | null {
  const index = playerIndex(player, rounds, coursesById).current;
  if (index === null) return null;
  let best: { net: number; round: Round } | null = null;
  let n = 0;
  let netSum = 0;
  let grossSum = 0;
  let beat = 0;
  for (const round of rounds) {
    if (round.holes !== "all" || !isIndividuallyScored(round)) continue;
    const course = coursesById.get(round.courseId);
    const g = round.scores[player.id];
    if (!course || !g || g.length !== course.holes.length || g.some((s) => !(s > 0))) continue;
    const recv = hypotheticalReceived(index, round, course, player.id);
    if (!recv) continue;
    const gross = totalScore(g);
    const net = gross - recv.reduce((s, v) => s + v, 0);
    n += 1;
    netSum += net;
    grossSum += gross;
    if (net < course.holes.reduce((s, h) => s + h.par, 0)) beat += 1;
    if (!best || net < best.net) best = { net, round };
  }
  if (!best) return null;
  return {
    rounds: n,
    bestNet: best.net,
    bestRoundId: best.round.id,
    bestCourseId: best.round.courseId,
    bestDate: best.round.date,
    avgNet: Math.round((netSum / n) * 10) / 10,
    avgGross: Math.round((grossSum / n) * 10) / 10,
    beatPar: beat,
  };
}
