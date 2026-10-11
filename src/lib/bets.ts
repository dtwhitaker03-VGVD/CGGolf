import type { Bet, Course, NewBet, Payment, Round } from "../types";
import { holeIndexes, totalScore } from "./golf";

export type BetResult =
  | { status: "win"; winnerId: string; loserId: string; amount: number; margin: number }
  | { status: "push"; margin: number }
  | { status: "void"; reason: string }
  | { status: "open"; margin: number; through: number };

interface Scoring {
  scores: Record<string, number[]>;
  droppedPlayers?: Record<string, number>;
  holeCount: number;
}

/** What the favorite risks and what the underdog risks. */
export function favRisk(bet: Pick<NewBet, "stake" | "favOdds">): number {
  return round2(bet.stake * bet.favOdds);
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Compare the two totals over the first `through` holes. Positive = favorite is ahead (strokes). */
function marginFor(bet: NewBet, s: Scoring, through: number): number {
  const fav = totalScore((s.scores[bet.favId] ?? []).slice(0, through));
  if (bet.type === "overunder") {
    // Distance of the favorite's total from the line, signed so positive = favorite is winning the bet.
    const diff = (bet.line ?? 0) - fav;
    return bet.side === "over" ? -diff : diff;
  }
  const dog = totalScore((s.scores[bet.dogId] ?? []).slice(0, through));
  return dog - fav;
}

/**
 * Work out a bet from the scores. With `finished` false (a round in progress)
 * it reports the current margin over the holes both players have scored.
 */
export function evaluateBet(bet: NewBet, s: Scoring, finished: boolean): BetResult {
  const a = s.scores[bet.favId];
  const b = s.scores[bet.dogId];
  if (!a || !b) return { status: "void", reason: "Player not in round" };
  if (finished) {
    if (s.droppedPlayers?.[bet.favId] !== undefined || s.droppedPlayers?.[bet.dogId] !== undefined) {
      return { status: "void", reason: "Left early" };
    }
    const need = s.holeCount;
    const ok = (arr: number[]) => arr.length === need && arr.every((v) => v > 0);
    if (!ok(a) || (bet.type !== "overunder" && !ok(b))) return { status: "void", reason: "Incomplete scores" };
    const margin = marginFor(bet, s, need);
    const threshold = bet.type === "spread" ? bet.line ?? 0 : 0;
    if (margin === threshold) return { status: "push", margin };
    const favWins = margin > threshold;
    const amount = favWins ? bet.stake : favRisk(bet);
    return {
      status: "win",
      winnerId: favWins ? bet.favId : bet.dogId,
      loserId: favWins ? bet.dogId : bet.favId,
      amount,
      margin,
    };
  }
  const through = bet.type === "overunder" ? a.length : Math.min(a.length, b.length);
  return { status: "open", margin: marginFor(bet, s, through), through };
}

export function evaluateSaved(bet: Bet, round: Round, course: Course | undefined): BetResult {
  if (!course) return { status: "void", reason: "Course missing" };
  const holeCount = holeIndexes(course, round.holes).length;
  return evaluateBet(bet, { scores: round.scores, droppedPlayers: round.droppedPlayers, holeCount }, true);
}

export function describeBet(bet: NewBet, name: (id: string) => string): string {
  const odds = bet.favOdds === 1 ? "even" : `${bet.favOdds}-1`;
  const risk = `${name(bet.favId)} risks $${favRisk(bet)} to win $${bet.stake}`;
  const money = bet.favOdds === 1 ? `$${bet.stake} each` : risk;
  if (bet.type === "straight") return `${name(bet.favId)} vs ${name(bet.dogId)}, lowest score · ${odds} · ${money}`;
  if (bet.type === "spread") {
    return `${name(bet.favId)} gives ${name(bet.dogId)} ${bet.line} strokes · ${odds} · ${money}`;
  }
  return `${name(bet.favId)} ${bet.side} ${bet.line} (vs ${name(bet.dogId)}) · ${odds} · ${money}`;
}

/** Plain-English status for a bet in progress or finished. */
export function describeResult(bet: NewBet, r: BetResult, name: (id: string) => string): string {
  const n = (v: number) => Math.abs(v);
  if (r.status === "void") return `Void — ${r.reason}`;
  if (r.status === "push") return "Push — nobody pays";
  if (r.status === "win") return `${name(r.winnerId)} wins $${r.amount} from ${name(r.loserId)}`;
  if (r.through === 0) return "Not started";
  const who = r.margin > 0 ? name(bet.favId) : r.margin < 0 ? name(bet.dogId) : null;
  if (bet.type === "spread") {
    const line = bet.line ?? 0;
    return `${name(bet.favId)} ${r.margin >= 0 ? "leads" : "trails"} by ${n(r.margin)} through ${r.through}` +
      ` · needs more than ${line}`;
  }
  if (bet.type === "overunder") {
    return `${name(bet.favId)} is ${n(r.margin)} ${r.margin >= 0 ? "ahead of" : "behind"} the line through ${r.through}`;
  }
  return who ? `${who} ahead by ${n(r.margin)} through ${r.through}` : `Even through ${r.through}`;
}

export interface LedgerEntry {
  betId: string;
  roundId: string;
  date: string;
  winnerId: string;
  loserId: string;
  amount: number;
}

/** Every settled, non-push bet as who-owes-who. */
export function ledgerFromBets(bets: Bet[], rounds: Round[], coursesById: Map<string, Course>): LedgerEntry[] {
  const byId = new Map(rounds.map((r) => [r.id, r]));
  const out: LedgerEntry[] = [];
  for (const bet of bets) {
    const round = byId.get(bet.roundId);
    if (!round) continue;
    const r = evaluateSaved(bet, round, coursesById.get(round.courseId));
    if (r.status === "win") {
      out.push({ betId: bet.id, roundId: round.id, date: round.date, winnerId: r.winnerId, loserId: r.loserId, amount: r.amount });
    }
  }
  return out;
}

export interface Balance {
  /** debtor owes creditor `amount`. */
  debtorId: string;
  creditorId: string;
  amount: number;
}

/** Pairwise net balances after bets and recorded payments. */
export function balances(ledger: LedgerEntry[], payments: Payment[]): Balance[] {
  const net = new Map<string, number>(); // key "a|b" (a<b): positive = b owes a
  const add = (debtor: string, creditor: string, amt: number) => {
    const [a, b] = debtor < creditor ? [debtor, creditor] : [creditor, debtor];
    const key = `${a}|${b}`;
    net.set(key, (net.get(key) ?? 0) + (creditor === a ? amt : -amt));
  };
  for (const e of ledger) add(e.loserId, e.winnerId, e.amount);
  for (const p of payments) add(p.toId, p.fromId, p.amount); // paying reduces what the payer owes
  const out: Balance[] = [];
  for (const [key, v] of net) {
    const [a, b] = key.split("|");
    const amt = round2(Math.abs(v));
    if (amt < 0.005) continue;
    out.push(v > 0 ? { debtorId: b, creditorId: a, amount: amt } : { debtorId: a, creditorId: b, amount: amt });
  }
  return out.sort((x, y) => y.amount - x.amount);
}

/** Lifetime winnings (+) and losses (-) per player from bets alone. */
export function lifetimeTotals(ledger: LedgerEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of ledger) {
    m.set(e.winnerId, round2((m.get(e.winnerId) ?? 0) + e.amount));
    m.set(e.loserId, round2((m.get(e.loserId) ?? 0) - e.amount));
  }
  return m;
}
