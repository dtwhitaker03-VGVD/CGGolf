import type {
  Course,
  PlayerSetup,
  RoundHoles,
  RoundMode,
  ScoringMethod,
  TeamGameType,
} from "../types";
import { playedHoles, stablefordPoints, strokesReceived, totalScore } from "./golf";
import { computeHoleWins, teamPerHoleScores } from "./matchplay";

/** The parts of a round (saved or in progress) that standings are computed from. */
export interface RoundState {
  holes: RoundHoles;
  mode: RoundMode;
  scoring: ScoringMethod;
  playerIds: string[];
  scores: Record<string, number[]>;
  setups: Record<string, PlayerSetup>;
  teamAssignments?: Record<string, number>;
  teamGameType?: TeamGameType;
  teamHandicap?: boolean;
  droppedPlayers?: Record<string, number>;
}

export function isTeamRound(r: Pick<RoundState, "mode">): boolean {
  return r.mode === "team";
}

export function isScramble(r: Pick<RoundState, "mode" | "teamGameType">): boolean {
  return r.mode === "team" && r.teamGameType === "scramble";
}

/** Scramble scores are one shared ball, so they say nothing about an individual's game. */
export function isIndividuallyScored(r: Pick<RoundState, "mode" | "teamGameType">): boolean {
  return !isScramble(r);
}

/** Whether handicap strokes are taken off the scores that decide this round. */
export function appliesStrokes(r: Pick<RoundState, "mode" | "teamGameType" | "teamHandicap">): boolean {
  if (r.mode === "handicap") return true;
  return r.mode === "team" && r.teamGameType !== "scramble" && Boolean(r.teamHandicap);
}

/** Handicap strokes received per hole (zeros when strokes aren't in play). */
function receivedByHole(r: RoundState, course: Course, pid: string): number[] {
  const holes = playedHoles(course, r.holes);
  const setup = r.setups[pid];
  if (!appliesStrokes(r) || !setup) return holes.map(() => 0);
  return strokesReceived(setup.playingHandicap, holes, setup.useWomenIndex);
}

/**
 * The per-hole scores that decide a round: gross, minus handicap strokes
 * where those apply. Only the first `through` holes (and only the holes a
 * player stayed for) are included.
 */
export function effectiveScores(r: RoundState, course: Course, pid: string, through: number): number[] {
  const gross = r.scores[pid] ?? [];
  const received = receivedByHole(r, course, pid);
  const n = Math.min(through, gross.length);
  return gross.slice(0, n).map((g, i) => g - (received[i] ?? 0));
}

function parThrough(course: Course, which: RoundHoles, n: number): number {
  return playedHoles(course, which)
    .slice(0, n)
    .reduce((s, h) => s + h.par, 0);
}

export interface PlayerRow {
  pid: string;
  /** Holes counted for this player (fewer than `through` if they left early). */
  played: number;
  gross: number;
  grossRel: number;
  /** Total of the scores that decide the round (net when strokes apply). */
  total: number;
  /** `total` relative to par over the holes counted. */
  rel: number;
  points: number;
  holesWon: number;
  holesHalved: number;
  left?: number;
}

/**
 * Individual standings through the first `through` holes, best first for the
 * round's scoring method. Players who left early count only their own holes.
 * With `onlyActive`, players who have already left are left out (live view).
 */
export function individualStandings(
  r: RoundState,
  course: Course,
  through: number,
  onlyActive = false,
): PlayerRow[] {
  const holes = playedHoles(course, r.holes);
  const ids = r.playerIds.filter((pid) => !(onlyActive && r.droppedPlayers && pid in r.droppedPlayers));
  const eff = Object.fromEntries(ids.map((pid) => [pid, effectiveScores(r, course, pid, through)]));
  const wins = computeHoleWins(
    through,
    ids.map((pid) => ({ id: pid, perHoleScores: eff[pid] })),
  );

  const rows = ids.map((pid): PlayerRow => {
    const gross = (r.scores[pid] ?? []).slice(0, through);
    const received = strokesReceived(
      r.setups[pid]?.playingHandicap ?? null,
      holes,
      r.setups[pid]?.useWomenIndex,
    );
    const played = gross.length;
    const par = parThrough(course, r.holes, played);
    const total = totalScore(eff[pid]);
    return {
      pid,
      played,
      gross: totalScore(gross),
      grossRel: totalScore(gross) - par,
      total,
      rel: total - par,
      points: gross.reduce((s, g, i) => s + stablefordPoints(g, holes[i].par, received[i] ?? 0), 0),
      holesWon: wins[pid].holesWon,
      holesHalved: wins[pid].holesHalved,
      left: r.droppedPlayers?.[pid],
    };
  });

  return rows.sort((a, b) => {
    if (r.scoring === "holes") return b.holesWon - a.holesWon || a.rel - b.rel;
    if (r.scoring === "stableford") return b.points - a.points || a.rel - b.rel;
    return a.rel - b.rel;
  });
}

export interface TeamRow {
  teamIndex: number;
  memberIds: string[];
  total: number;
  /** Total relative to the team's par baseline (par x members for team total). */
  rel: number;
  holesWon: number;
  holesHalved: number;
}

export function teamIndexes(r: RoundState): number[] {
  const set = new Set(r.playerIds.map((pid) => r.teamAssignments?.[pid] ?? 0));
  return [...set].sort((a, b) => a - b);
}

/** Team standings through the first `through` holes, best first. */
export function teamStandings(r: RoundState, course: Course, through: number): TeamRow[] {
  if (!r.teamGameType) return [];
  const gameType = r.teamGameType;
  const groups = teamIndexes(r).map((teamIndex) => ({
    teamIndex,
    memberIds: r.playerIds.filter((pid) => (r.teamAssignments?.[pid] ?? 0) === teamIndex),
  }));
  const eff = Object.fromEntries(
    r.playerIds.map((pid) => [pid, effectiveScores(r, course, pid, through)]),
  );
  const perHole = Object.fromEntries(
    groups.map((g) => [g.teamIndex, teamPerHoleScores(gameType, g.memberIds, eff, through)]),
  );
  const wins = computeHoleWins(
    through,
    groups.map((g) => ({ id: String(g.teamIndex), perHoleScores: perHole[g.teamIndex] })),
  );
  const par = parThrough(course, r.holes, Math.min(through, playedHoles(course, r.holes).length));

  return groups
    .map((g): TeamRow => {
      const total = perHole[g.teamIndex].reduce<number>((s, v) => s + (v ?? 0), 0);
      const baseline = par * (gameType === "teamTotal" ? g.memberIds.length : 1);
      const w = wins[String(g.teamIndex)];
      return { ...g, total, rel: total - baseline, holesWon: w.holesWon, holesHalved: w.holesHalved };
    })
    .sort((a, b) =>
      r.scoring === "holes" ? b.holesWon - a.holesWon || a.rel - b.rel : a.rel - b.rel,
    );
}

/**
 * Honors: whoever scored lowest on the previous hole plays first. One stable
 * sort per completed hole means a tie keeps whoever already had honors, like
 * the real rule. Uses net scores in handicapped rounds. Not used for teams.
 */
export function honorsOrder(
  r: RoundState,
  course: Course,
  ids: string[],
  holesCompleted: number,
): string[] {
  const eff = Object.fromEntries(
    ids.map((pid) => [pid, effectiveScores(r, course, pid, holesCompleted)]),
  );
  let order = ids;
  for (let h = 0; h < holesCompleted; h++) {
    order = [...order].sort((a, b) => (eff[a][h] ?? Infinity) - (eff[b][h] ?? Infinity));
  }
  return order;
}

export function modeLabel(r: Pick<RoundState, "mode" | "teamGameType">): string {
  if (r.mode === "straight") return "Straight up";
  if (r.mode === "handicap") return "Handicapped";
  return r.teamGameType === "scramble"
    ? "Team · Scramble"
    : r.teamGameType === "bestBall"
      ? "Team · Best ball"
      : "Team · Team total";
}

export function scoringLabel(s: ScoringMethod): string {
  return s === "strokes" ? "By strokes" : s === "holes" ? "By holes" : "Stableford";
}

export function teamName(teamIndex: number): string {
  return `Team ${teamIndex + 1}`;
}
