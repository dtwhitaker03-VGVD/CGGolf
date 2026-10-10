import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { findTee, formatVsPar, playedHoles, playerResult, setupStrokes, totalScore } from "../lib/golf";
import {
  appliesStrokes,
  isScramble,
  modeLabel,
  scoringLabel,
  teamIndexes,
  teamName,
} from "../lib/rounds";
import { Button, Card, EmptyState, LinkButton, PageHeader, TeeDot } from "../components/ui";
import { ScoreStepper } from "../components/ScoreStepper";
import { Leaderboards } from "../components/Leaderboards";
import { roundTags } from "../components/RoundSummary";

/** Circle for birdie or better, square for bogey or worse -- the traditional scorecard marks. */
function scoreMark(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff <= -2) return "rounded-full ring-2 ring-blue-500 ring-offset-1";
  if (diff === -1) return "rounded-full ring-1 ring-blue-500";
  if (diff === 1) return "ring-1 ring-red-400";
  if (diff >= 2) return "ring-2 ring-red-500 ring-offset-1";
  return "";
}

export function RoundDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rounds, players, coursesById, playersById, updateRound, deleteRound } = useAppData();

  const round = useMemo(() => rounds.find((r) => r.id === id), [rounds, id]);
  const course = round ? coursesById.get(round.courseId) : undefined;

  // Rounds are locked once saved -- "Edit scores" opts into the steppers so a stray tap can't change them.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, number[]> | null>(null);
  const [busy, setBusy] = useState(false);

  if (!round || !course) {
    return (
      <EmptyState icon="📋" title="Round not found" action={<LinkButton to="/rounds">Round history</LinkButton>} />
    );
  }

  const holes = playedHoles(course, round.holes);
  const scores = draft ?? round.scores;
  const view = { ...round, scores };
  const strokesOn = appliesStrokes(round);
  const scramble = isScramble(round);
  const received = Object.fromEntries(
    round.playerIds.map((pid) => [pid, round.setups[pid] ? setupStrokes(course, round.holes, round.setups[pid]) : []]),
  );
  const teamOf = (pid: string) => round.teamAssignments?.[pid] ?? 0;

  async function saveEdits() {
    if (!draft) return;
    setBusy(true);
    try {
      await updateRound(round!.id, { scores: draft });
      setDraft(null);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  function setScore(pid: string, h: number, value: number) {
    const base = draft ?? round!.scores;
    // A scramble is one shared ball, so a change applies to the whole team.
    const targets = scramble ? round!.playerIds.filter((p) => teamOf(p) === teamOf(pid)) : [pid];
    const next = { ...base };
    for (const t of targets) next[t] = base[t].map((s, i) => (i === h ? value : s));
    setDraft(next);
  }

  return (
    <div>
      <PageHeader
        title={course.name}
        subtitle={`${round.date} · ${roundTags(round)}`}
        action={
          <button
            type="button"
            className="text-sm font-medium text-green-700"
            onClick={() => {
              if (editing) {
                setDraft(null);
                setEditing(false);
              } else setEditing(true);
            }}
          >
            {editing ? "Cancel" : "Edit scores"}
          </button>
        }
      />

      <Leaderboards
        round={view}
        course={course}
        players={players}
        through={holes.length}
        className="mb-4"
      />

      {round.mode !== "team" && (
        <Card className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            {modeLabel(round)} · {scoringLabel(round.scoring)}
          </p>
          <ul className="divide-y divide-slate-100">
            {round.playerIds.map((pid) => {
              const player = playersById.get(pid);
              const r = playerResult(view, course, pid);
              const setup = round.setups[pid];
              const tee = setup ? findTee(course, setup.tee) : undefined;
              if (!r) return null;
              return (
                <li key={pid} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium" style={{ color: player?.color }}>
                      {player?.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {tee && <TeeDot color={tee.color} className="mr-1" />}
                      {setup?.tee}
                      {setup?.playingHandicap !== null && setup?.playingHandicap !== undefined
                        ? ` · ${setup.playingHandicap} strokes`
                        : " · scratch"}
                    </p>
                  </div>
                  <p className="text-right text-xs text-slate-500 tabular-nums">
                    Gross {r.gross} ({formatVsPar(r.vsPar)}) · Net {r.net} · {r.stableford} pts
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="mb-4 overflow-x-auto">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Scorecard</p>
        {editing ? (
          <div className="divide-y divide-slate-100">
            {holes.map((h, i) => (
              <div key={h.number} className="py-2">
                <p className="text-xs text-slate-400 mb-1">
                  Hole {h.number} · par {h.par}
                </p>
                {(scramble
                  ? teamIndexes(round).map((t) => round.playerIds.find((p) => teamOf(p) === t)!)
                  : round.playerIds
                )
                  .filter((pid) => (scores[pid]?.length ?? 0) > i)
                  .map((pid) => (
                    <div key={pid} className="flex items-center justify-between py-1">
                      <span className="text-sm font-medium" style={{ color: playersById.get(pid)?.color }}>
                        {scramble ? teamName(teamOf(pid)) : playersById.get(pid)?.name}
                      </span>
                      <ScoreStepper
                        value={scores[pid][i]}
                        par={h.par}
                        strokes={strokesOn ? Math.max(0, received[pid]?.[i] ?? 0) : 0}
                        onChange={(v) => setScore(pid, i, v)}
                      />
                    </div>
                  ))}
              </div>
            ))}
          </div>
        ) : (
          [0, 1].map((half) => {
            const slice = holes.slice(half * 9, half * 9 + 9);
            if (slice.length === 0) return null;
            const start = half * 9;
            return (
              <table key={half} className="w-full text-sm tabular-nums mb-3 last:mb-0">
                <thead>
                  <tr className="text-xs text-slate-400">
                    <th className="text-left font-medium pb-1 w-14">Hole</th>
                    {slice.map((h) => (
                      <th key={h.number} className="font-medium pb-1">
                        {h.number}
                      </th>
                    ))}
                    <th className="font-medium pb-1 pl-1">{holes.length > 9 ? (half === 0 ? "Out" : "In") : "Tot"}</th>
                  </tr>
                  <tr className="text-xs text-slate-400">
                    <th className="text-left font-medium pb-1">Par</th>
                    {slice.map((h) => (
                      <th key={h.number} className="font-medium pb-1">
                        {h.par}
                      </th>
                    ))}
                    <th className="font-medium pb-1 pl-1">{slice.reduce((s, h) => s + h.par, 0)}</th>
                  </tr>
                </thead>
                <tbody className="text-center">
                  {round.playerIds.map((pid) => {
                    const player = playersById.get(pid);
                    const row = scores[pid] ?? [];
                    return (
                      <tr key={pid} className="border-t border-slate-100">
                        <td className="py-1.5 text-left text-xs font-medium truncate max-w-14" style={{ color: player?.color }}>
                          {player?.name.split(" ")[0]}
                          {round.mode === "team" && <span className="text-slate-400"> T{teamOf(pid) + 1}</span>}
                        </td>
                        {slice.map((h, i) => {
                          const s = row[start + i];
                          const dots = strokesOn ? Math.max(0, received[pid]?.[start + i] ?? 0) : 0;
                          return (
                            <td key={h.number}>
                              {s === undefined ? (
                                ""
                              ) : (
                                <span className={`inline-block min-w-6 px-0.5 ${scoreMark(s, h.par)}`}>{s}</span>
                              )}
                              {dots > 0 && <span className="block text-[8px] leading-none text-green-700">{"•".repeat(Math.min(dots, 3))}</span>}
                            </td>
                          );
                        })}
                        <td className="pl-1 font-semibold">{totalScore(row.slice(start, start + 9))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })
        )}
        {!editing && (
          <p className="text-[11px] text-slate-400 mt-2">
            {strokesOn && "Dots mark holes where a player received handicap strokes. "}Circles = birdie or better;
            boxes = bogey or worse.
          </p>
        )}
      </Card>

      {editing ? (
        <Button className="w-full mb-3" disabled={busy || !draft} onClick={saveEdits}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      ) : (
        <Button
          variant="danger"
          className="w-full"
          onClick={async () => {
            if (confirm("Delete this round?")) {
              await deleteRound(round.id);
              navigate("/rounds", { replace: true });
            }
          }}
        >
          Delete round
        </Button>
      )}
    </div>
  );
}
