import type { Course, Player, Round } from "../types";
import { formatVsPar, roundHolesLabel } from "../lib/golf";
import {
  appliesStrokes,
  individualStandings,
  modeLabel,
  scoringLabel,
  teamName,
  teamStandings,
} from "../lib/rounds";

/** One-line tags describing how a round was played (mode, scoring, holes). */
export function roundTags(round: Round): string {
  const parts = [modeLabel(round)];
  if (round.mode !== "team" || round.teamGameType !== "scramble") parts.push(scoringLabel(round.scoring));
  if (round.holes !== "all") parts.push(roundHolesLabel(round.holes));
  return parts.join(" · ");
}

/** Compact standings for a saved round, for lists: players or teams, best first. */
export function RoundSummary({
  round,
  course,
  playersById,
}: {
  round: Round;
  course: Course;
  playersById: Map<string, Player>;
}) {
  const n = round.scores[round.playerIds[0]]?.length ?? 0;
  const through = Math.max(n, ...round.playerIds.map((pid) => round.scores[pid]?.length ?? 0));

  if (round.mode === "team") {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {teamStandings(round, course, through).map((t) => (
          <span key={t.teamIndex}>
            <span className="font-medium text-slate-800">{teamName(t.teamIndex)}</span>{" "}
            <span className="tabular-nums text-slate-600">
              {round.scoring === "holes" ? `${t.holesWon} won` : `${t.total} (${formatVsPar(t.rel)})`}
            </span>
          </span>
        ))}
      </div>
    );
  }

  const net = appliesStrokes(round);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {individualStandings(round, course, through).map((row) => {
        const player = playersById.get(row.pid);
        if (!player) return null;
        return (
          <span key={row.pid}>
            <span style={{ color: player.color }} className="font-medium">
              {player.name}
            </span>{" "}
            <span className="tabular-nums text-slate-600">
              {round.scoring === "holes"
                ? `${row.holesWon} won`
                : round.scoring === "stableford"
                  ? `${row.points} pts`
                  : net
                    ? `${row.gross} (${formatVsPar(row.rel)} net)`
                    : `${row.gross} (${formatVsPar(row.grossRel)})`}
              {row.left !== undefined && <span className="text-amber-600"> · left h{row.left}</span>}
            </span>
          </span>
        );
      })}
    </div>
  );
}
