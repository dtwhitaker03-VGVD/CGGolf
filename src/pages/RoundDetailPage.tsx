import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import {
  findTee,
  formatLabel,
  formatValue,
  formatVsPar,
  playedHoles,
  playerResult,
  rankResults,
  roundHolesLabel,
  setupStrokes,
  totalScore,
  type PlayerResult,
} from "../lib/golf";
import { Button, Card, EmptyState, LinkButton, PageHeader, TeeDot } from "../components/ui";
import { ScoreStepper } from "../components/ScoreStepper";
import type { RoundFormat } from "../types";

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
  const { rounds, coursesById, playersById, updateRound, deleteRound } = useAppData();

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
  const results = round.playerIds
    .map((pid) => playerResult(view, course, pid))
    .filter((r): r is PlayerResult => r !== null);
  const ranked = rankResults(results, round.format);
  const received = Object.fromEntries(
    round.playerIds.map((pid) => [pid, round.setups[pid] ? setupStrokes(course, round.holes, round.setups[pid]) : []]),
  );

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

  async function changeFormat(format: RoundFormat) {
    await updateRound(round!.id, { format });
  }

  function setScore(pid: string, h: number, value: number) {
    const base = draft ?? round!.scores;
    setDraft({ ...base, [pid]: base[pid].map((s, i) => (i === h ? value : s)) });
  }

  return (
    <div>
      <PageHeader
        title={course.name}
        subtitle={`${round.date} · ${roundHolesLabel(round.holes)}`}
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

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Results · {formatLabel(round.format)}
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {ranked.map((r, i) => {
            const player = playersById.get(r.playerId);
            const setup = round.setups[r.playerId];
            const tee = setup ? findTee(course, setup.tee) : undefined;
            return (
              <li key={r.playerId} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm text-slate-400 w-4">{i + 1}</span>
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
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-semibold text-lg leading-tight">{formatValue(r, round.format)}</p>
                  <p className="text-[11px] text-slate-400">
                    Gross {r.gross} ({formatVsPar(r.vsPar)}) · Net {r.net} · {r.stableford} pts
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-1.5 mt-3">
          {(["gross", "net", "stableford"] as RoundFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => void changeFormat(f)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold border ${
                round.format === f
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              Rank by {f}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4 overflow-x-auto">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Scorecard</p>
        {editing ? (
          <div className="divide-y divide-slate-100">
            {holes.map((h, i) => (
              <div key={h.number} className="py-2">
                <p className="text-xs text-slate-400 mb-1">
                  Hole {h.number} · par {h.par}
                </p>
                {round.playerIds.map((pid) => (
                  <div key={pid} className="flex items-center justify-between py-1">
                    <span className="text-sm font-medium" style={{ color: playersById.get(pid)?.color }}>
                      {playersById.get(pid)?.name}
                    </span>
                    <ScoreStepper
                      value={scores[pid]?.[i] ?? h.par}
                      par={h.par}
                      strokes={Math.max(0, received[pid]?.[i] ?? 0)}
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
                        </td>
                        {slice.map((h, i) => {
                          const s = row[start + i];
                          const dots = Math.max(0, received[pid]?.[start + i] ?? 0);
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
            Dots mark holes where a player received handicap strokes. Circles = birdie or better; boxes = bogey
            or worse.
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
