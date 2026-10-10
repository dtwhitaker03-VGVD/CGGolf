import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { playerIndex } from "../lib/players";
import {
  coursePar,
  findTee,
  formatLabel,
  formatVsPar,
  holeIndexes,
  playedHoles,
  playingHandicap,
  roundHolesLabel,
  stablefordPoints,
  strokesReceived,
} from "../lib/golf";
import { Button, Card, EmptyState, Field, LinkButton, PageHeader, TeeDot, inputClass } from "../components/ui";
import { ScoreStepper } from "../components/ScoreStepper";
import type { PlayerSetup, RoundFormat, RoundHoles } from "../types";

const DRAFT_KEY = "cggolf-round-draft";

interface PlayerEntry {
  tee: string;
  /** Handicap index text for this round (blank = no handicap). */
  index: string;
}

interface Draft {
  step: 1 | 2 | 3;
  courseId: string;
  date: string;
  holes: RoundHoles;
  format: RoundFormat;
  selected: string[];
  entries: Record<string, PlayerEntry>;
  scores: Record<string, number[]>;
  hole: number;
  reached: number;
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
    // Storage can be unavailable (private mode); the round just won't survive a refresh.
  }
}

const FORMATS: { value: RoundFormat; label: string; hint: string }[] = [
  { value: "gross", label: "Gross", hint: "Lowest total strokes wins" },
  { value: "net", label: "Net", hint: "Strokes minus handicap strokes" },
  { value: "stableford", label: "Stableford", hint: "Points per hole, net of handicap" },
];

export function NewRoundPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { courses, players, rounds, coursesById, addPlayer, addRound } = useAppData();

  const draft = useMemo(() => {
    const d = loadDraft();
    // Ignore a draft whose course has since been deleted.
    return d && coursesById.has(d.courseId) ? d : null;
  }, [coursesById]);

  const self = players.find((p) => p.isSelf);
  const [step, setStep] = useState<1 | 2 | 3>(draft?.step ?? 1);
  const [courseId, setCourseId] = useState(
    draft?.courseId ?? params.get("course") ?? courses[0]?.id ?? "",
  );
  const [date, setDate] = useState(draft?.date ?? today());
  const [holesPlayed, setHolesPlayed] = useState<RoundHoles>(draft?.holes ?? "all");
  const [format, setFormat] = useState<RoundFormat>(draft?.format ?? "gross");
  const [selected, setSelected] = useState<string[]>(draft?.selected ?? (self ? [self.id] : []));
  const [entries, setEntries] = useState<Record<string, PlayerEntry>>(draft?.entries ?? {});
  const [scores, setScores] = useState<Record<string, number[]>>(draft?.scores ?? {});
  const [hole, setHole] = useState(draft?.hole ?? 0);
  const [reached, setReached] = useState(draft?.reached ?? 0);
  const [guestName, setGuestName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const course = coursesById.get(courseId);
  const holes = useMemo(() => (course ? playedHoles(course, holesPlayed) : []), [course, holesPlayed]);
  const idx = useMemo(() => (course ? holeIndexes(course, holesPlayed) : []), [course, holesPlayed]);

  // Preselect yourself once your player row has loaded.
  useEffect(() => {
    if (!draft && self && selected.length === 0) setSelected([self.id]);
  }, [draft, self, selected.length]);

  // Keep the in-progress round on this device so a refresh or phone sleep doesn't lose it.
  useEffect(() => {
    if (!courseId || step === 1) return;
    saveDraft({ step, courseId, date, holes: holesPlayed, format, selected, entries, scores, hole, reached });
  }, [step, courseId, date, holesPlayed, format, selected, entries, scores, hole, reached]);

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
    const idx = player ? playerIndex(player, rounds, coursesById).current : null;
    return { tee: defaultTee(), index: idx === null ? "" : String(idx) };
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

  function startScoring() {
    const next: Record<string, number[]> = {};
    for (const pid of selected) {
      const prev = scores[pid];
      next[pid] = holes.map((h, i) => prev?.[i] ?? h.par);
    }
    setScores(next);
    setHole(0);
    setReached(0);
    setStep(3);
  }

  function setScore(pid: string, h: number, value: number) {
    setScores((prev) => ({ ...prev, [pid]: prev[pid].map((s, i) => (i === h ? value : s)) }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const setups = Object.fromEntries(selected.map((pid) => [pid, buildSetup(pid)]));
      const round = await addRound({
        courseId,
        date,
        holes: holesPlayed,
        format,
        playerIds: selected,
        scores,
        setups,
      });
      saveDraft(null);
      navigate(`/round/${round.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the round.");
      setBusy(false);
    }
  }

  function cancel() {
    if (confirm("Throw away this round?")) {
      saveDraft(null);
      navigate("/");
    }
  }

  // ----- Step 1: course & format -----
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
              {courses.map((c) => (
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
                <p className="text-xs text-slate-400 mt-1">
                  Nine-hole rounds don't count toward a handicap index.
                </p>
              )}
            </Field>
          )}
          <Field label="Scoring">
            <div className="space-y-2">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 border ${
                    format === f.value ? "border-green-700 bg-green-50" : "border-slate-300 bg-white"
                  }`}
                >
                  <span className="font-semibold text-slate-900 text-sm">{f.label}</span>
                  <span className="block text-xs text-slate-500">{f.hint}</span>
                </button>
              ))}
              <p className="text-xs text-slate-400">
                Gross strokes are always recorded, so you can look at net and Stableford afterward too.
              </p>
            </div>
          </Field>
        </Card>
        <Button className="w-full" onClick={() => setStep(2)}>
          Next: players
        </Button>
      </div>
    );
  }

  // ----- Step 2: players & tees -----
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

  // ----- Step 3: scoring -----
  const setups = Object.fromEntries(selected.map((pid) => [pid, buildSetup(pid)]));
  const received = Object.fromEntries(
    selected.map((pid) => [
      pid,
      strokesReceived(setups[pid].playingHandicap, holes, setups[pid].useWomenIndex),
    ]),
  );
  const isLast = hole === holes.length - 1;
  const onSummary = hole >= holes.length;
  const h = holes[Math.min(hole, holes.length - 1)];

  // Live standings: every hole up to the one being scored counts, so the
  // leaderboard updates as scores are tapped in.
  const through = onSummary ? holes.length : Math.min(Math.max(reached, hole + 1), holes.length);
  const standings = selected
    .map((pid) => {
      const gross = scores[pid].slice(0, through);
      const g = gross.reduce((s, v) => s + v, 0);
      const strokes = received[pid].slice(0, through).reduce((s, v) => s + v, 0);
      const pts = gross.reduce((s, v, i) => s + stablefordPoints(v, holes[i].par, received[pid][i]), 0);
      const parSoFar = holes.slice(0, through).reduce((s, x) => s + x.par, 0);
      return { pid, gross: g, net: g - strokes, pts, vsPar: g - parSoFar, netVsPar: g - strokes - parSoFar };
    })
    .sort((a, b) =>
      format === "stableford" ? b.pts - a.pts : format === "net" ? a.net - b.net : a.gross - b.gross,
    );

  function goTo(next: number) {
    setHole(next);
    setReached((r) => Math.max(r, Math.min(next, holes.length)));
  }

  const leaderboard = (
    <Card className="mb-3 mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
        Leaderboard · {formatLabel(format)}
        {through < holes.length && ` · thru ${through}`}
      </p>
      <div className="space-y-1.5">
        {standings.map((s, i) => {
          const p = players.find((x) => x.id === s.pid);
          if (!p) return null;
          return (
            <div key={s.pid} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="text-slate-400 w-4">{i + 1}</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="font-medium text-slate-800">{p.name}</span>
              </span>
              <span className="tabular-nums text-slate-500">
                {format === "stableford" ? (
                  <>
                    {s.gross} ({formatVsPar(s.vsPar)}) ·{" "}
                    <span className="font-semibold text-slate-900">{s.pts} pts</span>
                  </>
                ) : format === "net" ? (
                  <>
                    {s.gross} ({formatVsPar(s.vsPar)}) ·{" "}
                    <span className="font-semibold text-slate-900">{formatVsPar(s.netVsPar)}</span>
                  </>
                ) : (
                  <span className="font-semibold text-slate-900">
                    {s.gross} ({formatVsPar(s.vsPar)})
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="New round"
        subtitle={`${course.name} · ${roundHolesLabel(holesPlayed)} · par ${par}`}
        action={
          <button type="button" className="text-xs text-slate-400 underline" onClick={cancel}>
            Cancel
          </button>
        }
      />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
        {holes.map((x, i) => (
          <button
            key={x.number}
            type="button"
            ref={
              i === hole
                ? (el) => el?.scrollIntoView({ inline: "center", block: "nearest" })
                : undefined
            }
            onClick={() => goTo(i)}
            className={`shrink-0 w-9 h-9 rounded-full text-sm font-semibold ${
              i === hole ? "bg-green-700 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {x.number}
          </button>
        ))}
      </div>

      {!onSummary ? (
        <>
          <Card className="mb-3">
            <div className="flex items-end justify-between mb-3">
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
            <div className="divide-y divide-slate-100">
              {selected.map((pid) => {
                const p = players.find((x) => x.id === pid);
                return (
                  <div key={pid} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium" style={{ color: p?.color }}>
                        {p?.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {received[pid][hole] > 0
                          ? `Gets ${received[pid][hole]} stroke${received[pid][hole] === 1 ? "" : "s"} here`
                          : received[pid][hole] < 0
                            ? "Gives a stroke back"
                            : "No stroke"}
                      </p>
                    </div>
                    <ScoreStepper
                      value={scores[pid][hole]}
                      par={h.par}
                      strokes={Math.max(0, received[pid][hole])}
                      onChange={(v) => setScore(pid, hole, v)}
                    />
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => (hole === 0 ? setStep(2) : setHole(hole - 1))}
            >
              {hole === 0 ? "Back" : "Previous hole"}
            </Button>
            <Button className="flex-1" onClick={() => goTo(isLast ? holes.length : hole + 1)}>
              {isLast ? "Finish" : "Next hole"}
            </Button>
          </div>

          {leaderboard}
        </>
      ) : (
        <>
          <Card className="mb-3 overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-slate-400">
                  <th className="text-left font-medium pb-1">Player</th>
                  <th className="font-medium pb-1">Gross</th>
                  <th className="font-medium pb-1">Net</th>
                  <th className="font-medium pb-1">Pts</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {standings.map((s) => {
                  const p = players.find((x) => x.id === s.pid);
                  return (
                    <tr key={s.pid} className="border-t border-slate-100">
                      <td className="py-2 text-left font-medium" style={{ color: p?.color }}>
                        {p?.name}
                      </td>
                      <td>
                        {s.gross} <span className="text-xs text-slate-400">({formatVsPar(s.vsPar)})</span>
                      </td>
                      <td>{s.net}</td>
                      <td>{s.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <p className="text-xs text-slate-400 mb-3">
            Tap a hole number above to fix a score before saving.
          </p>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setHole(holes.length - 1)}>
              ← Back
            </Button>
            <Button className="flex-1" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save round"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
