export interface Hole {
  number: number;
  par: number;
  /** Stroke index (handicap rank) 1 = hardest .. N = easiest, as printed on the scorecard. */
  strokeIndex: number;
  /** Alternate stroke index printed for women's play, when the scorecard has one. */
  strokeIndexW?: number;
}

export interface Tee {
  name: string;
  /** Display color for the tee marker. */
  color: string;
  /** USGA course rating from this tee. Missing = tee is unrated (rounds won't count toward a handicap index). */
  rating?: number;
  slope?: number;
  /** Use each hole's women's stroke index (strokeIndexW) when allocating strokes from this tee. */
  useWomenIndex?: boolean;
  /** Yards per hole, same order as the course's holes. */
  yards: number[];
}

export interface Course {
  id: string;
  name: string;
  location?: string;
  holes: Hole[];
  tees: Tee[];
  /** Keep this course out of the New Round course picker (it still has its own page, rounds and stats). */
  hideFromNewRound?: boolean;
  createdAt: string;
}

export interface Player {
  id: string;
  name: string;
  isSelf?: boolean;
  /** True if this player has their own login (vs. a guest added by name only). */
  hasAccount?: boolean;
  color: string;
  /**
   * Handicap index to use until the app has enough rounds (3+ rated 18-hole
   * rounds) to calculate one -- e.g. an index from the player's GHIN card.
   */
  createdAt: string;
}

/** Everything about one player's setup for a round, locked in at round start. */
export interface PlayerSetup {
  tee: string;
  rating?: number;
  slope?: number;
  useWomenIndex?: boolean;
  /**
   * Playing handicap for the holes in this round (strokes received),
   * or null if the player has no handicap index yet (plays scratch).
   */
  playingHandicap: number | null;
}

export type RoundHoles = "all" | "front" | "back";
/** Straight up = everyone plays scratch; handicap = strokes by hole; team = teams. */
export type RoundMode = "straight" | "handicap" | "team";
/** How a winner is decided: lowest strokes, most holes won (match play), or Stableford points. */
export type ScoringMethod = "strokes" | "holes" | "stableford";
/**
 * - scramble: the team plays one ball, one shared score per hole (not counted toward handicap).
 * - bestBall: everyone plays their own ball; the team's score on a hole is its lowest.
 * - teamTotal: everyone plays their own ball; the team's score is the sum of teammates.
 */
export type TeamGameType = "scramble" | "bestBall" | "teamTotal";

export interface Round {
  id: string;
  courseId: string;
  date: string; // ISO date (yyyy-mm-dd)
  /** Which holes were played: all 18, or just the front/back nine. */
  holes: RoundHoles;
  mode: RoundMode;
  scoring: ScoringMethod;
  playerIds: string[];
  /** playerId -> gross strokes per hole played, in hole order. */
  scores: Record<string, number[]>;
  setups: Record<string, PlayerSetup>;
  /** playerId -> team index (0-based), for team rounds. */
  teamAssignments?: Record<string, number>;
  teamGameType?: TeamGameType;
  /** Team rounds only: apply handicap strokes to best ball / team total scores. */
  teamHandicap?: boolean;
  /**
   * playerId -> how many holes they played before leaving early. Their score
   * through that point is kept, but the round doesn't count toward their
   * handicap or course stats since it isn't a complete round.
   */
  droppedPlayers?: Record<string, number>;
  notes?: string;
  createdAt: string;
}

export type BetType = "straight" | "spread" | "overunder";

/**
 * A private wager between two players on one round. The underdog risks
 * `stake`; the favorite risks stake x favOdds (1 = even bet).
 * - straight: lowest total wins.
 * - spread: the favorite lays `line` strokes; wins only by MORE than `line`, exactly `line` is a push.
 * - overunder: the favorite's total against `line`; the favorite takes `side`, the other player the opposite.
 */
export interface Bet {
  id: string;
  roundId: string;
  type: BetType;
  favId: string;
  dogId: string;
  line?: number;
  side?: "under" | "over";
  stake: number;
  favOdds: number;
}

export type NewBet = Omit<Bet, "id" | "roundId">;

export interface Payment {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  note?: string;
  createdAt: string;
}
