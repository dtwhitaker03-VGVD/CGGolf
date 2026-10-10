import type { Course, Player } from "../types";
import { formatVsPar } from "../lib/golf";
import {
  appliesStrokes,
  individualStandings,
  teamName,
  teamStandings,
  type RoundState,
} from "../lib/rounds";
import { Card } from "./ui";

/**
 * The leaderboard card for a round (saved or in progress) through the first
 * `through` holes: individual standings for straight/handicapped rounds, team
 * standings for team rounds. Labelled and formatted for the scoring method.
 */
export function Leaderboards({
  round,
  course,
  players,
  through,
  live = false,
  className = "mb-3",
}: {
  round: RoundState;
  course: Course;
  players: Player[];
  through: number;
  /** Live scoring view: players who left early are hidden. */
  live?: boolean;
  className?: string;
}) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const net = appliesStrokes(round);

  if (round.mode === "team") {
    const teams = teamStandings(round, course, through);
    return (
      <Card className={className}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Team leaderboard
        </p>
        <div className="space-y-2">
          {teams.map((t, i) => (
            <div key={t.teamIndex} className="flex items-center justify-between text-sm gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-slate-400 w-4 shrink-0">{i + 1}</span>
                <span className="font-medium text-slate-800">
                  {teamName(t.teamIndex)}{" "}
                  <span className="text-xs text-slate-400 font-normal">
                    ({t.memberIds.map((id) => byId.get(id)?.name).join(", ")})
                  </span>
                </span>
              </span>
              <span className="font-semibold text-slate-900 tabular-nums shrink-0">
                {round.scoring === "holes"
                  ? `${t.holesWon} won (${formatVsPar(t.rel)})`
                  : `${t.total} (${formatVsPar(t.rel)})`}
              </span>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const rows = individualStandings(round, course, through, live);
  const title =
    round.scoring === "holes"
      ? "Holes won"
      : round.scoring === "stableford"
        ? "Stableford points"
        : net
          ? "Net leaderboard"
          : "Leaderboard";

  return (
    <Card className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{title}</p>
      <div className="space-y-1.5">
        {rows.map((row, i) => {
          const player = byId.get(row.pid);
          if (!player) return null;
          return (
            <div key={row.pid} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="text-slate-400 w-4">{i + 1}</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.color }} />
                <span className="font-medium text-slate-800">{player.name}</span>
                {row.left !== undefined && (
                  <span className="text-[10px] text-amber-600 font-normal">left h{row.left}</span>
                )}
              </span>
              <span className="tabular-nums text-slate-500">
                {round.scoring === "holes" ? (
                  <span className="font-semibold text-slate-900">
                    {row.holesWon} won ({formatVsPar(row.rel)})
                  </span>
                ) : round.scoring === "stableford" ? (
                  <>
                    {row.gross} ({formatVsPar(row.grossRel)}) ·{" "}
                    <span className="font-semibold text-slate-900">{row.points} pts</span>
                  </>
                ) : net ? (
                  <>
                    {row.gross} ({formatVsPar(row.grossRel)}) ·{" "}
                    <span className="font-semibold text-slate-900">{formatVsPar(row.rel)}</span>
                  </>
                ) : (
                  <span className="font-semibold text-slate-900">
                    {row.gross} ({formatVsPar(row.grossRel)})
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
