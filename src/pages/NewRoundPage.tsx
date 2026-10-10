import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { playerIndex } from "../lib/players";
import {
  findTee,
  formatVsPar,
  holeIndexes,
  playedHoles,
  playingHandicap,
  roundHolesLabel,
  strokesReceived,
  coursePar,
} from "../lib/golf";
import {
  appliesStrokes,
  honorsOrder,
  individualStandings,
  isScramble,
  teamIndexes,
  teamName,
  type RoundState,
} from "../lib/rounds";
import { Button, Card, EmptyState, Field, LinkButton, PageHeader, TeeDot, inputClass } from "../components/ui";
import { ScoreStepper } from "../components/ScoreStepper";
import { Leaderboards } from "../components/Leaderboards";
import type { PlayerSetup, RoundHoles, RoundMode, ScoringMethod, TeamGameType } from "../types";

// In-progress round state is kept on this device so closing or reloading the
// app mid-round doesn't lose it -- it's only saved to Supabase once finalized.
const DRAFT_KEY = "cggolf-round-draft";

interface PlayerEntry {
  tee: string;
  /** Handicap index text for this round (blank = no handicap). */
  index: string;
}

interface Draft {
  step: 1 | 2 | 3 | 4;
  courseId: string;
  date: string;
  holes: RoundHoles;
  selected: string[];
  entries: Record<string, PlayerEntry>;
  mode: RoundMode;
  scoring: ScoringMethod;
  teamGameType: TeamGameType;
  teamHandicap: boolean;
  teamOf: Record<string, number>;
  teamCount: number;
  scores: Record<string, number[]>;
  dropped: Record<string, number>;
  hole: number;
}

function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage can be unavailable (private mode); the round just won't survive a reload.
  }
}

function Pill({
  active,
  onClick,
  children,
  disabled,
  small,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40 ${small ? "text-xs" : "text-sm"} ${
        active ? "bg-green-700 text-white" : "bg-slate-100 text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

export function NewRoundPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { courses, players, rounds, coursesById, addPlayer, addRound } = useAppData();

  const [pendingDraft, setPendingDraft] = useState<Draft | null>(() => {
    const d = loadDraft();
    if (d && courses.some((c) => c.id === d.courseId)) return d;
    if (d) saveDraft(null);
    return null;
  });

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [courseId, setCourseId] = useState(params.get("course") ?? courses.find((c) => !c.hideFromNewRound)?.id ?? courses[0]?.id ?? "");
  const [date, setDate] = useState(today());
  const [holesPlayed, setHolesPlayed] = useState<RoundHoles>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<string, PlayerEntry>>({});
  const [mode, setMode] = useState<RoundMode>("straight");
  const [scoring, setScoring] = useState<ScoringMethod>("strokes");
  const [teamGameType, setTeamGameType] = useState<TeamGameType>("bestBall");
  const [teamHandicap, setTeamHandicap] = useState(false);
  const [teamOf, setTeamOf] = useState<Record<string, number>>({});
  const [teamCount, setTeamCount] = useState(2);
  const [scores, setScores] = useState<Record<string, number[]>>({});
  const [dropped, setDropped] = useState<Record<string, number>>({});
  const [hole, setHole] = useState(0);
  const [guestName, setGuestName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const course = coursesById.get(courseId);
  const holes = useMemo(() => (course ? playedHoles(course, holesPlayed) : []), [course, holesPlayed]);
  const idx = useMemo(() => (course ? holeIndexes(course, holesPlayed) : []), [course, holesPlayed]);

  function resumeDraft() {
    if (!pendingDraft) return;
    const d = pendingDraft;
    const valid = d.selected.filter((pid) => players.some((p) => p.id === pid));
    setCourseId(d.courseId);
    setDate(d.date);
    setHolesPlayed(d.holes);
    setSelected(valid);
    setEntries(d.entries);
    setMode(d.mode);
    setScoring(d.scoring);
    setTeamGameType(d.teamGameType);
    setTeamHandicap(d.teamHandicap);
    setTeamOf(d.teamOf);
    setTeamCount(d.teamCount);
    setScores(d.scores);
    setDropped(d.dropped);
    setHole(d.hole);
    setStep(valid.length > 0 ? d.step : 2);
    setPendingDraft(null);
  }

  function discardDraft() {
    saveDraft(null);
    setPendingDraft(null);
  }

  function discardRound() {
    if (!confirm("Throw away this round?")) return;
    saveDraft(null);
    navigate("/");
  }

  // Once any resume prompt is settled, keep saving progress so a reload can pick up where you left off.
  useEffect(() => {
    if (pendingDraft || !courseId || step === 1) return;
    saveDraft({
      step, courseId, date, holes: holesPlayed, selected, entries, mode, scoring,
      teamGameType, teamHandicap, teamOf, teamCount, scores, dropped, hole,
    });
  }, [pendingDraft, step, courseId, date, holesPlayed, selected, entries, mode, scoring, teamGameType, teamHandicap, teamOf, teamCount, scores, dropped, hole]);

  // Preselect yourself once your player row has loaded.
  const preselectedSelf = useRef(false);
  useEffect(() => {
    if (preselectedSelf.current || pendingDraft) return;
    const self = players.find((p) => p.isSelf);
    if (self) {
      setSelected((prev) => (prev.includes(self.id) ? prev : [...prev, self.id]));
      preselectedSelf.current = true;
    }
  }, [players, pendingDraft]);

  // Keep mode/scoring combinations valid: fewer than two players means a straight round,
  // and Stableford only makes sense when handicap strokes are in play.
  useEffect(() => {
    if (selected.length < 2 && mode !== "straight") setMode("straight");
    if (scoring === "stableford" && mode !== "handicap") setScoring("strokes");
  }, [selected.length, mode, scoring]);

  // Auto-assign anyone without a team, round-robin, so switching to team mode needs no manual placing.
  useEffect(() => {
    if (mode !== "team") return;
    setTeamOf((prev) => {
      let changed = false;
      const next = { ...prev };
      selected.forEach((pid, i) => {
        if (next[pid] === undefined) {
          next[pid] = i % teamCount;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [mode, selected, teamCount]);

  if (pendingDraft) {
    const d = pendingDraft;
    const dc = courses.find((c) => c.id === d.courseId);
    return (
      <div>
        <PageHeader title="Round in progress" />
        <Card className="space-y-3">
          <p className="text-slate-700">
            You have an unfinished round at <span className="font-semibold">{dc?.name ?? "a course"}</span>
            {d.step === 3 && ` (hole ${d.hole + 1})`}
            {d.step === 4 && " (reviewing final scores)"}.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={discardDraft}>
              Start new round instead
            </Button>
            <Button className="flex-1" onClick={resumeDraft}>
              Continue round
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <EmptyState
        icon="⛳"
        title="Add a course first"
        action={<LinkButton to="/courses/new">Add a course</LinkButton>}
      />
    );
  }
  if (!course) return null;

  const par = coursePar(course, holesPlayed);

  function defaultTee(): string {
    const white = course!.tees.find((t) => t.name.toLowerCase() === "white");
    return (white ?? course!.tees[0]).name;
  }

  function entryFor(playerId: string): PlayerEntry {
    const existing = entries[playerId];
    if (existing && findTee(course!, existing.tee)) return existing;
    const player = players.find((p) => p.id === playerId);
    const current = player ? playerIndex(player, rounds, coursesById).current : null;
    return { tee: defaultTee(), index: current === null ? "" : String(current) };
  }

  function patchEntry(playerId: string, patch: Partial<PlayerEntry>) {
    setEntries((prev) => ({ ...prev, [playerId]: { ...entryFor(playerId), ...prev[playerId], ...patch } }));
  }

  function buildSetup(playerId: string): PlayerSetup {
    const e = entryFor(playerId);
    const tee = findTee(course!, e.tee) ?? course!.tees[0];
    const parsed = e.index.trim() === "" ? null : Number(e.index.replace(/^\+/, "-"));
    const index = parsed !== null && Number.isFinite(parsed) ? parsed : null;
    return {
      tee: tee.name,
      rating: tee.rating,
      slope: tee.slope,
      useWomenIndex: tee.useWomenIndex,
      playingHandicap: index === null ? null : playingHandicap(index, tee, course!, holesPlayed),
    };
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function addGuest() {
    const name = guestName.trim();
    if (!name) return;
    try {
      const p = await addPlayer(name);
      setSelected((prev) => [...prev, p.id]);
      setGuestName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that player.");
    }
  }

  function adjustTeamCount(delta: number) {
    const next = Math.max(2, Math.min(6, teamCount + delta));
    if (next === teamCount) return;
    setTeamCount(next);
    if (next < teamCount) {
      // Anyone on a removed team moves to the last remaining one.
      setTeamOf((prev) => {
        const updated = { ...prev };
        for (const pid of Object.keys(updated)) if ((updated[pid] ?? 0) >= next) updated[pid] = next - 1;
        return updated;
      });
    }
  }

  function startScoring() {
    const initial: Record<string, number[]> = {};
    for (const pid of selected) initial[pid] = holes.map((h) => h.par);
    setScores(initial);
    setDropped({});
    setHole(0);
    setStep(3);
  }

  function setScore(pid: string, h: number, value: number) {
    setScores((prev) => ({ ...prev, [pid]: prev[pid].map((s, i) => (i === h ? value : s)) }));
  }

  // Scramble: the team shares one ball, so one entry is written to every teammate's score.
  function setTeamScore(teamIndex: number, h: number, value: number) {
    const members = selected.filter((pid) => (teamOf[pid] ?? 0) === teamIndex);
    setScores((prev) => {
      const next = { ...prev };
      for (const pid of members) next[pid] = prev[pid].map((s, i) => (i === h ? value : s));
      return next;
    });
  }

  // Locks in a player's score through the holes already played and drops them from the rest of the round.
  function dropPlayer(pid: string) {
    const player = players.find((p) => p.id === pid);
    if (!player) return;
    if (!confirm(`Remove ${player.name} from the rest of this round? Their score through hole ${hole} will still be saved.`)) return;
    setScores((prev) => ({ ...prev, [pid]: (prev[pid] ?? []).slice(0, hole) }));
    setDropped((prev) => ({ ...prev, [pid]: hole }));
  }

  const isTeam = mode === "team";
  const setups = Object.fromEntries(selected.map((pid) => [pid, buildSetup(pid)]));
  const state: RoundState = {
    holes: holesPlayed,
    mode,
    scoring,
    playerIds: selected,
    scores,
    setups,
    teamAssignments: isTeam ? Object.fromEntries(selected.map((pid) => [pid, teamOf[pid] ?? 0])) : undefined,
    teamGameType: isTeam ? teamGameType : undefined,
    teamHandicap: isTeam && teamGameType !== "scramble" ? teamHandicap : undefined,
    droppedPlayers: Object.keys(dropped).length > 0 ? dropped : undefined,
  };
  const strokesOn = appliesStrokes(state);
  const scramble = isScramble(state);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const round = await addRound({
        courseId,
        date,
        holes: holesPlayed,
        mode,
        scoring,
        playerIds: selected,
        scores,
        setups,
        teamAssignments: state.teamAssignments,
        teamGameType: state.teamGameType,
        teamHandicap: state.teamHandicap,
        droppedPlayers: state.droppedPlayers,
      });
      saveDraft(null);
      navigate(`/round/${round.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the round.");
      setBusy(false);
    }
  }

  // ----- Step 1: course, date, holes -----
  if (step === 1) {
    return (
      <div>
        <PageHeader title="New round" subtitle="Step 1 of 3 · Course" />
        <Card className="space-y-4 mb-4">
          <Field label="Course">
            <select
              className={inputClass}
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setHolesPlayed("all");
                setEntries({});
              }}
            >
              {/* Courses marked "hide from New Round" stay out of the list unless one is already selected. */}
              {courses.filter((c) => !c.hideFromNewRound || c.id === courseId).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {course.holes.length > 9 && (
            <Field label="Holes">
              <div className="grid grid-cols-3 gap-2">
                {(["all", "front", "back"] as RoundHoles[]).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHolesPlayed(h)}
                    className={`rounded-xl py-2.5 text-sm font-semibold border ${
                      holesPlayed === h
                        ? "bg-green-700 text-white border-green-700"
                        : "bg-white text-slate-700 border-slate-300"
                    }`}
                  >
                    {roundHolesLabel(h)}
                  </button>
                ))}
              </div>
              {holesPlayed !== "all" && (
                <p className="text-xs text-slate-400 mt-1">Nine-hole rounds don't count toward a handicap index.</p>
              )}
            </Field>
          )}
        </Card>
        <Button className="w-full" onClick={() => setStep(2)}>
          Next: players
        </Button>
      </div>
    );
  }

  // ----- Step 2: players, tees, round type -----
  if (step === 2) {
    return (
      <div>
        <PageHeader title="Who's playing?" subtitle={`Step 2 of 3 · ${course.name}`} />
        <div className="space-y-3 mb-4">
          {players.map((p) => {
            const on = selected.includes(p.id);
            const e = entryFor(p.id);
            const tee = findTee(course, e.tee) ?? course.tees[0];
            const setup = on ? buildSetup(p.id) : null;
            return (
              <Card key={p.id} className={on ? "border-green-600" : ""}>
                <label className="flex items-center gap-2.5">
                  <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="w-5 h-5" />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="font-medium text-slate-800">
                    {p.name}
                    {p.isSelf ? " (you)" : ""}
                  </span>
                </label>
                {on && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Tee">
                      <select
                        className={inputClass}
                        value={tee.name}
                        onChange={(ev) => patchEntry(p.id, { tee: ev.target.value })}
                      >
                        {course.tees.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Handicap index">
                      <input
                        inputMode="decimal"
                        className={inputClass}
                        placeholder="none"
                        value={e.index}
                        onChange={(ev) => patchEntry(p.id, { index: ev.target.value })}
                      />
                    </Field>
                    <p className="col-span-2 text-xs text-slate-500 -mt-1">
                      <TeeDot color={tee.color} className="mr-1" />
                      {tee.rating !== undefined && tee.slope !== undefined
                        ? `${tee.rating}/${tee.slope}`
                        : "Unrated tee (won't count toward index)"}
                      {" · "}
                      {setup?.playingHandicap === null || setup === null
                        ? "No handicap — plays scratch"
                        : `Gets ${setup.playingHandicap} stroke${Math.abs(setup.playingHandicap) === 1 ? "" : "s"}`}
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <Card className="mb-4 space-y-2">
          <Field label="Add a guest">
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Friend's name"
              />
              <Button variant="secondary" disabled={!guestName.trim()} onClick={addGuest}>
                Add
              </Button>
            </div>
          </Field>
          <p className="text-xs text-slate-400">
            Index is pre-filled from each player's current handicap; edit it for this round if needed. Leave
            blank to play with no strokes.
          </p>
        </Card>

        {(
          <Card className="mb-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Round type</p>
            <div className="flex gap-2 mb-2 flex-wrap">
              <Pill active={mode === "straight"} onClick={() => setMode("straight")}>
                Straight up
              </Pill>
              <Pill disabled={selected.length < 2} active={mode === "handicap"} onClick={() => setMode("handicap")}>
                Handicapped
              </Pill>
              <Pill disabled={selected.length < 2} active={mode === "team"} onClick={() => setMode("team")}>
                Team
              </Pill>
            </div>
            {selected.length < 2 && (
              <p className="text-xs text-slate-400 mb-2">Check at least two players above to play Handicapped or Team.</p>
            )}

            {mode === "straight" && (
              <p className="text-xs text-slate-400 mb-3">
                Everyone plays scratch — individual scores, and rounds count toward handicaps.
              </p>
            )}

            {mode === "handicap" && (
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-1">
                  Each player gets strokes on the hardest holes by hole handicap, so scores are compared net.
                </p>
                {selected.map((pid) => {
                  const player = players.find((p) => p.id === pid);
                  const ph = setups[pid].playingHandicap;
                  return (
                    <p key={pid} className="text-xs text-slate-500">
                      <span className="font-medium" style={{ color: player?.color }}>
                        {player?.name}
                      </span>{" "}
                      {ph === null ? "no handicap (scratch)" : `${ph} stroke${Math.abs(ph) === 1 ? "" : "s"}`}
                    </p>
                  );
                })}
              </div>
            )}

            {mode === "team" && (
              <div className="mb-3">
                <div className="flex gap-2 mb-2 flex-wrap">
                  <Pill small active={teamGameType === "scramble"} onClick={() => setTeamGameType("scramble")}>
                    Scramble
                  </Pill>
                  <Pill small active={teamGameType === "bestBall"} onClick={() => setTeamGameType("bestBall")}>
                    Best ball
                  </Pill>
                  <Pill small active={teamGameType === "teamTotal"} onClick={() => setTeamGameType("teamTotal")}>
                    Team total
                  </Pill>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  {teamGameType === "scramble"
                    ? "Teammates share one ball — enter a single score per team each hole. Doesn't count toward anyone's handicap."
                    : teamGameType === "bestBall"
                      ? "Everyone plays their own ball and counts toward their handicap as usual. The team's score on each hole is its lowest."
                      : "Everyone plays their own ball and counts toward their handicap as usual. The team's score is the sum of teammates' scores."}
                </p>
                {teamGameType !== "scramble" && (
                  <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
                    <input
                      type="checkbox"
                      checked={teamHandicap}
                      onChange={(e) => setTeamHandicap(e.target.checked)}
                      className="w-4 h-4"
                    />
                    Apply handicap strokes (net scores)
                  </label>
                )}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">Number of teams</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustTeamCount(-1)}
                      disabled={teamCount <= 2}
                      className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-semibold disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold tabular-nums w-4 text-center">{teamCount}</span>
                    <button
                      type="button"
                      onClick={() => adjustTeamCount(1)}
                      disabled={teamCount >= 6}
                      className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-semibold disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {selected.map((pid) => {
                    const player = players.find((p) => p.id === pid);
                    if (!player) return null;
                    return (
                      <div key={pid} className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: player.color }} />
                          {player.name}
                        </span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {Array.from({ length: teamCount }, (_, i) => i).map((t) => (
                            <Pill
                              small
                              key={t}
                              active={(teamOf[pid] ?? 0) === t}
                              onClick={() => setTeamOf((prev) => ({ ...prev, [pid]: t }))}
                            >
                              {teamName(t)}
                            </Pill>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-sm font-medium text-slate-700 mb-2">Scoring</p>
            <div className="flex gap-2 mb-2">
              <Pill small active={scoring === "strokes"} onClick={() => setScoring("strokes")}>
                Strokes
              </Pill>
              <Pill small active={scoring === "holes"} onClick={() => setScoring("holes")}>
                Holes
              </Pill>
              {mode === "handicap" && (
                <Pill small active={scoring === "stableford"} onClick={() => setScoring("stableford")}>
                  Stableford
                </Pill>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {scoring === "holes"
                ? `Lowest ${mode === "team" ? "team " : ""}${strokesOn || mode === "handicap" ? "net " : ""}score on a hole wins it (a tie halves it) — the result is holes won. Stroke totals are still kept.`
                : scoring === "stableford"
                  ? "Points per hole from net score: 2 for par, 3 for a birdie, 1 for a bogey, 0 for worse. Most points wins."
                  : "Lowest total strokes wins, as usual."}
            </p>
          </Card>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setStep(1)}>
            Back
          </Button>
          <Button className="flex-1" disabled={selected.length === 0} onClick={startScoring}>
            Start scoring
          </Button>
        </div>
      </div>
    );
  }

  // ----- Steps 3 & 4: scoring and review -----
  const isReview = step === 4;
  const activeIds = selected.filter((pid) => !(pid in dropped));
  const isLast = hole === holes.length - 1;
  const h = holes[Math.min(hole, holes.length - 1)];
  const received = Object.fromEntries(
    selected.map((pid) => [pid, strokesReceived(setups[pid].playingHandicap, holes, setups[pid].useWomenIndex)]),
  );
  // Holes already moved past count toward live totals; the review counts everything.
  const through = isReview ? holes.length : hole;
  const liveRows = Object.fromEntries(individualStandings(state, course, through).map((r) => [r.pid, r]));

  // Individual rounds put whoever has the honors first; team rounds group players by team.
  const order = isTeam
    ? [...selected].sort((a, b) => (teamOf[a] ?? 0) - (teamOf[b] ?? 0))
    : honorsOrder(state, course, activeIds, hole);

  const chips = (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
      {holes.map((x, i) => (
        <button
          key={x.number}
          type="button"
          ref={!isReview && i === hole ? (el) => el?.scrollIntoView({ inline: "center", block: "nearest" }) : undefined}
          onClick={() => {
            setHole(i);
            setStep(3);
          }}
          className={`shrink-0 w-9 h-9 rounded-full text-sm font-semibold ${
            !isReview && i === hole ? "bg-green-700 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          {x.number}
        </button>
      ))}
    </div>
  );

  if (isReview) {
    const columns = scramble
      ? teamIndexes(state).map((t) => ({
          key: `team-${t}`,
          label: teamName(t),
          pid: selected.find((pid) => (teamOf[pid] ?? 0) === t),
        }))
      : order.map((pid) => ({ key: pid, label: players.find((p) => p.id === pid)?.name ?? "", pid }));
    return (
      <div>
        <PageHeader
          title="New round"
          subtitle={`Review · ${course.name}`}
          action={
            <button type="button" className="text-xs text-slate-400 underline" onClick={discardRound}>
              Discard
            </button>
          }
        />
        {chips}
        {Object.keys(dropped).length > 0 && (
          <Card className="mb-3 bg-amber-50 border-amber-200">
            <p className="text-xs text-amber-800">
              {Object.entries(dropped)
                .map(([pid, n]) => `${players.find((p) => p.id === pid)?.name ?? "Someone"} left after hole ${n}`)
                .join(" · ")}
            </p>
          </Card>
        )}
        <Leaderboards round={state} course={course} players={players} through={holes.length} />

        <Card className="mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs">
                <th className="text-left font-medium pb-2 sticky left-0 bg-white pr-2">Hole</th>
                {columns.map((col) => (
                  <th key={col.key} className="font-medium pb-2 px-1 min-w-[56px]">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holes.map((x, i) => (
                <tr key={x.number} className="border-t border-slate-100">
                  <td className="py-1.5 sticky left-0 bg-white pr-2 whitespace-nowrap">
                    {x.number} <span className="text-slate-400">(par {x.par})</span>
                  </td>
                  {columns.map((col) => {
                    const droppedAt = col.pid ? dropped[col.pid] : undefined;
                    const gone = droppedAt !== undefined && i >= droppedAt;
                    const stroke = col.pid && strokesOn && !scramble ? Math.max(0, received[col.pid]?.[i] ?? 0) : 0;
                    return (
                      <td key={col.key} className="px-1 py-1.5 text-center tabular-nums">
                        {col.pid && !gone ? (scores[col.pid]?.[i] ?? x.par) : "—"}
                        {stroke > 0 && !gone && <span className="text-green-700 text-[9px]"> {"•".repeat(Math.min(stroke, 3))}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="py-1.5 sticky left-0 bg-white pr-2">Total</td>
                {columns.map((col) => {
                  const row = col.pid ? liveRows[col.pid] : undefined;
                  return (
                    <td key={col.key} className="px-1 py-1.5 text-center tabular-nums">
                      {row ? row.gross : 0}{" "}
                      <span className="text-slate-400 font-normal">({formatVsPar(row?.grossRel ?? 0)})</span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </Card>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setStep(3)}>
            Edit round
          </Button>
          <Button className="flex-1" disabled={busy} onClick={save}>
            {busy ? "Finalizing…" : "Finalize round"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New round"
        subtitle={`${course.name} · ${roundHolesLabel(holesPlayed)} · par ${par}`}
        action={
          <button type="button" className="text-xs text-slate-400 underline" onClick={discardRound}>
            Discard
          </button>
        }
      />

      {chips}

      <Card className="mb-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-slate-900 leading-none">Hole {h.number}</p>
            <p className="text-sm text-slate-500 mt-1">
              Par {h.par} · hole handicap {h.strokeIndex}
              {h.strokeIndexW !== undefined && h.strokeIndexW !== h.strokeIndex && ` (W ${h.strokeIndexW})`}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 space-y-0.5">
            {[...new Set(selected.map((pid) => setups[pid].tee))].map((teeName) => {
              const t = findTee(course, teeName);
              if (!t) return null;
              return (
                <div key={teeName}>
                  <TeeDot color={t.color} className="mr-1" />
                  {teeName} <span className="tabular-nums font-medium text-slate-700">{t.yards[idx[hole]]} yds</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="space-y-2 mb-4">
        {scramble
          ? teamIndexes(state).map((t) => {
              const members = selected.filter((pid) => (teamOf[pid] ?? 0) === t);
              const rep = members[0];
              if (!rep || !scores[rep]) return null;
              const row = liveRows[rep];
              return (
                <Card key={t} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-semibold text-slate-800">{teamName(t)}</p>
                    <p className="text-xs text-slate-400">{members.map((pid) => players.find((p) => p.id === pid)?.name).join(", ")}</p>
                    <p className="text-xs text-slate-400">
                      Total {row?.gross ?? 0} ({formatVsPar(row?.grossRel ?? 0)})
                    </p>
                  </div>
                  <ScoreStepper value={scores[rep][hole] ?? h.par} par={h.par} onChange={(v) => setTeamScore(t, hole, v)} />
                </Card>
              );
            })
          : order.map((pid, i) => {
              const player = players.find((p) => p.id === pid);
              const mine = scores[pid];
              if (!player || !mine) return null;
              const row = liveRows[pid];
              const got = Math.max(0, received[pid]?.[hole] ?? 0);
              return (
                <Card key={pid} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-semibold text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.color }} />
                      {player.name}
                      {!isTeam && hole > 0 && i === 0 && activeIds.length > 1 && (
                        <span className="text-[10px] font-semibold text-green-700 bg-green-50 rounded px-1.5 py-0.5">
                          Honors
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      Total {row?.gross ?? 0} ({formatVsPar(row?.grossRel ?? 0)})
                      {isTeam && ` · ${teamName(teamOf[pid] ?? 0)}`}
                      {strokesOn && got > 0 && ` · gets ${got} stroke${got === 1 ? "" : "s"}`}
                      {strokesOn && (received[pid]?.[hole] ?? 0) < 0 && " · gives a stroke back"}
                    </p>
                    {!isTeam && (
                      <button type="button" className="text-[11px] font-medium text-red-500 mt-0.5" onClick={() => dropPlayer(pid)}>
                        Left early
                      </button>
                    )}
                  </div>
                  <ScoreStepper
                    value={mine[hole] ?? h.par}
                    par={h.par}
                    strokes={strokesOn ? got : 0}
                    onChange={(v) => setScore(pid, hole, v)}
                  />
                </Card>
              );
            })}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => (hole === 0 ? setStep(2) : setHole(hole - 1))}>
          {hole === 0 ? "Back" : "Previous hole"}
        </Button>
        <Button className="flex-1" onClick={() => (isLast ? setStep(4) : setHole(hole + 1))}>
          {isLast ? "Finish" : "Next hole"}
        </Button>
      </div>

      <div className="mt-3">
        <Leaderboards round={state} course={course} players={players} through={hole} live />
      </div>

      <button type="button" className="text-sm font-medium text-slate-400 mt-3 block mx-auto" onClick={discardRound}>
        Discard round
      </button>
    </div>
  );
}
