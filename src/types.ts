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
  startingIndex?: number;
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
export type RoundFormat = "gross" | "net" | "stableford";

export interface Round {
  id: string;
  courseId: string;
  date: string; // ISO date (yyyy-mm-dd)
  /** Which holes were played: all 18, or just the front/back nine. */
  holes: RoundHoles;
  /** How the round's winner is decided. Gross strokes are always recorded. */
  format: RoundFormat;
  playerIds: string[];
  /** playerId -> gross strokes per hole played, in hole order. */
  scores: Record<string, number[]>;
  setups: Record<string, PlayerSetup>;
  notes?: string;
  createdAt: string;
}
