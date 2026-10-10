import { useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { playerIndex } from "../lib/players";
import { formatIndex, playerDifferentials } from "../lib/golf";
import { computeScoreStats, playerHoleCounts, playerTotalsByCourse } from "../lib/stats";
import { Card, EmptyState, LinkButton, PageHeader } from "../components/ui";
import { TrendChart } from "../components/TrendChart";

export function PlayerStatsPage() {
  const { id } = useParams();
  const { playersById, rounds, coursesById } = useAppData();
  const player = id ? playersById.get(id) : undefined;

  if (!player) {
    return <EmptyState icon="📈" title="Player not found" action={<LinkButton to="/stats">Back to stats</LinkButton>} />;
  }

  const idx = playerIndex(player, rounds, coursesById);
  const diffs = playerDifferentials(player.id, rounds, coursesById).sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );
  const counts = playerHoleCounts(player.id, rounds, coursesById);
  const byCourse = playerTotalsByCourse(player.id, rounds, coursesById);

  const rows: [string, number][] = [
    ["Aces", counts.aces],
    ["Eagles", counts.eagles],
    ["Birdies", counts.birdies],
    ["Pars", counts.pars],
    ["Bogeys", counts.bogeys],
    ["Double bogeys", counts.doubleBogeys],
    ["Triple or worse", counts.triplePlus],
  ];

  return (
    <div>
      <PageHeader title={player.name} subtitle="Handicap & scoring" />

      <Card className="mb-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Handicap index</p>
        <p className="text-4xl font-bold tabular-nums mt-1" style={{ color: player.color }}>
          {formatIndex(idx.current)}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {idx.calculated !== null
            ? `From your best differentials across ${Math.min(idx.rounds, 20)} recent rounds`
            : idx.fromStarting
              ? "Starting index — enter 3 rated 18-hole rounds to calculate it"
              : `Needs 3 complete rated 18-hole rounds (${idx.rounds} so far)`}
        </p>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
          Score differentials
        </p>
        <TrendChart
          points={diffs.map((d) => ({ date: d.date, value: d.value }))}
          color={player.color}
          label="Score differential per round"
        />
        <p className="text-[11px] text-slate-400 mt-1">Lower is better. Each point is one 18-hole round.</p>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Holes played · {counts.holesPlayed}
        </p>
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map(([label, n]) => (
            <li key={label} className="py-1.5 flex justify-between">
              <span className="text-slate-600">{label}</span>
              <span className="font-semibold tabular-nums">
                {n}
                {counts.holesPlayed > 0 && (
                  <span className="text-xs text-slate-400 font-normal">
                    {" "}
                    · {Math.round((n / counts.holesPlayed) * 100)}%
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {byCourse.size > 0 && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">By course (18 holes)</p>
          <ul className="divide-y divide-slate-100">
            {[...byCourse.entries()].map(([courseId, totals]) => {
              const stats = computeScoreStats(totals)!;
              return (
                <li key={courseId} className="py-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{coursesById.get(courseId)?.name}</span>
                  <span className="text-sm tabular-nums">
                    <span className="text-green-600 font-semibold">{stats.low}</span>
                    {" / "}
                    <span className="font-semibold">{stats.average}</span>
                    {" / "}
                    <span className="text-red-600 font-semibold">{stats.high}</span>
                    <span className="text-xs text-slate-400"> · {stats.rounds}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
