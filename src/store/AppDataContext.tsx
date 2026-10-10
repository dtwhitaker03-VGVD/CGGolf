import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";
import type {
  Course,
  Hole,
  Player,
  PlayerSetup,
  Round,
  RoundFormat,
  RoundHoles,
  Tee,
} from "../types";

const PLAYER_COLORS = [
  "#15803d",
  "#2563eb",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#4d7c0f",
];

interface CourseRow {
  id: string;
  name: string;
  location: string | null;
  holes: Hole[];
  tees: Tee[];
  created_at: string;
}

interface PlayerRow {
  id: string;
  user_id: string | null;
  name: string;
  color: string;
  starting_index: number | null;
  created_at: string;
}

interface RoundRow {
  id: string;
  course_id: string;
  date: string;
  holes_played: RoundHoles;
  format: RoundFormat;
  notes: string | null;
  created_at: string;
}

interface RoundScoreRow {
  round_id: string;
  player_id: string;
  strokes: number[];
  setup: PlayerSetup;
}

function mapCourse(row: CourseRow): Course {
  return {
    id: row.id,
    name: row.name,
    location: row.location ?? undefined,
    holes: row.holes,
    tees: row.tees,
    createdAt: row.created_at,
  };
}

function mapPlayer(row: PlayerRow, selfUserId: string | undefined): Player {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isSelf: Boolean(selfUserId) && row.user_id === selfUserId,
    hasAccount: row.user_id !== null,
    startingIndex: row.starting_index ?? undefined,
    createdAt: row.created_at,
  };
}

function mapRounds(roundRows: RoundRow[], scoreRows: RoundScoreRow[]): Round[] {
  const scoresByRound = new Map<string, RoundScoreRow[]>();
  for (const s of scoreRows) {
    const list = scoresByRound.get(s.round_id) ?? [];
    list.push(s);
    scoresByRound.set(s.round_id, list);
  }
  return roundRows.map((r) => {
    const rowScores = scoresByRound.get(r.id) ?? [];
    return {
      id: r.id,
      courseId: r.course_id,
      date: r.date,
      holes: r.holes_played,
      format: r.format,
      notes: r.notes ?? undefined,
      playerIds: rowScores.map((s) => s.player_id),
      scores: Object.fromEntries(rowScores.map((s) => [s.player_id, s.strokes])),
      setups: Object.fromEntries(rowScores.map((s) => [s.player_id, s.setup])),
      createdAt: r.created_at,
    };
  });
}

async function ensureSelfPlayer(user: User): Promise<void> {
  const { data: mine } = await supabase
    .from("golf_players")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (mine) return;

  const meta = user.user_metadata as { display_name?: string } | undefined;
  const name = (meta?.display_name || user.email?.split("@")[0] || "Player").trim();

  const { data: guest } = await supabase
    .from("golf_players")
    .select("id")
    .is("user_id", null)
    .ilike("name", name)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (guest) {
    await supabase.from("golf_players").update({ user_id: user.id }).eq("id", guest.id);
  } else {
    await supabase.from("golf_players").insert({ user_id: user.id, name });
  }
}

interface AppData {
  courses: Course[];
  players: Player[];
  rounds: Round[];
  loading: boolean;

  addCourse: (input: { name: string; location?: string; holes: Hole[]; tees: Tee[] }) => Promise<Course>;
  updateCourse: (id: string, patch: Partial<Omit<Course, "id" | "createdAt">>) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;

  addPlayer: (name: string) => Promise<Player>;
  updatePlayer: (id: string, patch: Partial<Omit<Player, "id" | "createdAt">>) => Promise<void>;
  deletePlayer: (id: string) => Promise<void>;

  addRound: (input: Omit<Round, "id" | "createdAt">) => Promise<Round>;
  updateRound: (id: string, patch: Partial<Omit<Round, "id" | "createdAt">>) => Promise<void>;
  deleteRound: (id: string) => Promise<void>;

  coursesById: Map<string, Course>;
  playersById: Map<string, Player>;
}

const AppDataCtx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const selfUserId = session?.user.id;

  const [courseRows, setCourseRows] = useState<CourseRow[]>([]);
  const [playerRows, setPlayerRows] = useState<PlayerRow[]>([]);
  const [roundRows, setRoundRows] = useState<RoundRow[]>([]);
  const [scoreRows, setScoreRows] = useState<RoundScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [c, p, r, s] = await Promise.all([
      supabase.from("golf_courses").select("*").order("name"),
      supabase.from("golf_players").select("*").order("created_at"),
      supabase.from("golf_rounds").select("*").order("date", { ascending: false }),
      supabase.from("golf_round_scores").select("*"),
    ]);
    if (c.data) setCourseRows(c.data as CourseRow[]);
    if (p.data) setPlayerRows(p.data as PlayerRow[]);
    if (r.data) setRoundRows(r.data as RoundRow[]);
    if (s.data) setScoreRows(s.data as RoundScoreRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    // Make sure this account has a player row (claiming a same-named guest if
    // one exists), then load everything. Done here rather than in a database
    // trigger so the app works without touching the shared auth schema.
    void ensureSelfPlayer(session.user).finally(loadAll);

    const channel = supabase
      .channel("cggolf-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "golf_courses" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "golf_players" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "golf_rounds" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "golf_round_scores" }, loadAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, loadAll]);

  const value = useMemo<AppData>(() => {
    const courses = courseRows.map(mapCourse);
    const players = playerRows.map((row) => mapPlayer(row, selfUserId));
    const rounds = mapRounds(roundRows, scoreRows);

    const addCourse: AppData["addCourse"] = async ({ name, location, holes, tees }) => {
      const { data, error } = await supabase
        .from("golf_courses")
        .insert({ name, location: location ?? null, holes, tees })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to add course");
      await loadAll();
      return mapCourse(data as CourseRow);
    };

    const updateCourse: AppData["updateCourse"] = async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.location !== undefined) dbPatch.location = patch.location ?? null;
      if (patch.holes !== undefined) dbPatch.holes = patch.holes;
      if (patch.tees !== undefined) dbPatch.tees = patch.tees;
      const { error } = await supabase.from("golf_courses").update(dbPatch).eq("id", id);
      if (error) throw new Error(error.message);
      await loadAll();
    };

    const deleteCourse: AppData["deleteCourse"] = async (id) => {
      const { error } = await supabase.from("golf_courses").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await loadAll();
    };

    const addPlayer: AppData["addPlayer"] = async (name) => {
      const color = PLAYER_COLORS[playerRows.length % PLAYER_COLORS.length];
      const { data, error } = await supabase
        .from("golf_players")
        .insert({ name, color })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to add player");
      await loadAll();
      return mapPlayer(data as PlayerRow, selfUserId);
    };

    const updatePlayer: AppData["updatePlayer"] = async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.color !== undefined) dbPatch.color = patch.color;
      if ("startingIndex" in patch) dbPatch.starting_index = patch.startingIndex ?? null;
      const { error } = await supabase.from("golf_players").update(dbPatch).eq("id", id);
      if (error) throw new Error(error.message);
      await loadAll();
    };

    const deletePlayer: AppData["deletePlayer"] = async (id) => {
      const { error } = await supabase.from("golf_players").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await loadAll();
    };

    const addRound: AppData["addRound"] = async (input) => {
      const { data: roundData, error: roundError } = await supabase
        .from("golf_rounds")
        .insert({
          course_id: input.courseId,
          date: input.date,
          holes_played: input.holes,
          format: input.format,
          notes: input.notes ?? null,
          created_by: playerRows.find((p) => p.user_id === selfUserId)?.id ?? null,
        })
        .select()
        .single();
      if (roundError || !roundData) throw new Error(roundError?.message ?? "Failed to add round");

      const scoreInserts = input.playerIds.map((playerId) => ({
        round_id: roundData.id,
        player_id: playerId,
        strokes: input.scores[playerId] ?? [],
        setup: input.setups[playerId],
      }));
      const { error: scoresError } = await supabase.from("golf_round_scores").insert(scoreInserts);
      if (scoresError) throw new Error(scoresError.message);

      await loadAll();
      return { ...input, id: roundData.id, createdAt: roundData.created_at };
    };

    const updateRound: AppData["updateRound"] = async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.date !== undefined) dbPatch.date = patch.date;
      if (patch.format !== undefined) dbPatch.format = patch.format;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes ?? null;
      if (Object.keys(dbPatch).length > 0) {
        const { error } = await supabase.from("golf_rounds").update(dbPatch).eq("id", id);
        if (error) throw new Error(error.message);
      }
      if (patch.scores) {
        for (const [playerId, strokes] of Object.entries(patch.scores)) {
          const { error } = await supabase
            .from("golf_round_scores")
            .update({ strokes })
            .eq("round_id", id)
            .eq("player_id", playerId);
          if (error) throw new Error(error.message);
        }
      }
      await loadAll();
    };

    const deleteRound: AppData["deleteRound"] = async (id) => {
      const { error } = await supabase.from("golf_rounds").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await loadAll();
    };

    return {
      courses,
      players,
      rounds,
      loading,
      addCourse,
      updateCourse,
      deleteCourse,
      addPlayer,
      updatePlayer,
      deletePlayer,
      addRound,
      updateRound,
      deleteRound,
      coursesById: new Map(courses.map((c) => [c.id, c])),
      playersById: new Map(players.map((p) => [p.id, p])),
    };
  }, [courseRows, playerRows, roundRows, scoreRows, loading, selfUserId, loadAll]);

  return <AppDataCtx.Provider value={value}>{children}</AppDataCtx.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataCtx);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

export function defaultHoles(count: number, par = 4): Hole[] {
  return Array.from({ length: count }, (_, i) => ({ number: i + 1, par, strokeIndex: i + 1 }));
}
