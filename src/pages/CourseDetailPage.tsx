import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { coursePar, formatRoundDate, formatVsPar, teeYards } from "../lib/golf";
import {
  computeScoreStats,
  courseHoleStats,
  courseTopScores,
  courseTotalsByPlayer,
} from "../lib/stats";
import { Card, EmptyState, LinkButton, PageHeader, TeeDot } from "../components/ui";

export function CourseDetailPage() {
  const { id } = useParams();
  const { coursesById, players, playersById, rounds } = useAppData();
  const course = id ? coursesById.get(id) : undefined;
  const [teeName, setTeeName] = useState<string | null>(null);

  if (!course) {
    return (
      <EmptyState
        icon="⛳"
        title="Course not found"
        action={<LinkButton to="/courses">Back to courses</LinkButton>}
      />
    );
  }

  const tee = course.tees.find((t) => t.name === teeName) ?? course.tees[0];
  const par = coursePar(course);
  const nines = course.holes.length > 9 ? [course.holes.slice(0, 9), course.holes.slice(9)] : [course.holes];
  const useW = tee?.useWomenIndex;
  const holeStats = courseHoleStats(course, rounds);
  const hasHoleData = holeStats.some((h) => h.entries > 0);

  const totalsByPlayer = courseTotalsByPlayer(course, rounds);
  const overall = computeScoreStats([...totalsByPlayer.values()].flat());
  // The record and Top 5 only count complete, individually scored rounds.
  const topScores = courseTopScores(course, rounds, 5);
  const recordEntry = topScores[0];
  const recordHolders = recordEntry
    ? [...new Set(topScores.filter((e) => e.total === recordEntry.total).map((e) => e.playerId))]
        .map((pid) => playersById.get(pid)?.name)
        .filter((n): n is string => Boolean(n))
    : [];
  const playerRows = [...totalsByPlayer.entries()]
    .map(([playerId, totals]) => ({
      player: players.find((p) => p.id === playerId),
      stats: computeScoreStats(totals),
    }))
    .filter((r): r is { player: NonNullable<typeof r.player>; stats: NonNullable<typeof r.stats> } =>
      Boolean(r.player && r.stats),
    )
    .sort((a, b) => a.stats.average - b.stats.average);

  return (
    <div>
      <PageHeader
        title={course.name}
        subtitle={[course.location, `par ${par}`].filter(Boolean).join(" · ")}
        action={
          <Link to={`/courses/${course.id}/edit`} className="text-sm font-medium text-green-700">
            Edit
          </Link>
        }
      />

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Tees</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="font-medium pb-1">Tee</th>
              <th className="font-medium pb-1 text-right">Yards</th>
              <th className="font-medium pb-1 text-right">Rating</th>
              <th className="font-medium pb-1 text-right">Slope</th>
            </tr>
          </thead>
          <tbody>
            {course.tees.map((t) => (
              <tr
                key={t.name}
                className={`cursor-pointer ${t.name === tee?.name ? "bg-green-50" : ""}`}
                onClick={() => setTeeName(t.name)}
              >
                <td className="py-1.5 pl-1">
                  <TeeDot color={t.color} className="mr-1.5" />
                  {t.name}
                </td>
                <td className="text-right tabular-nums">{teeYards(t, course).toLocaleString()}</td>
                <td className="text-right tabular-nums">{t.rating ?? "—"}</td>
                <td className="text-right tabular-nums pr-1">{t.slope ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-400 mt-2">Tap a tee to see its yardages below.</p>
      </Card>

      {tee &&
        nines.map((nine, n) => {
          const offset = n * 9;
          const label = nines.length === 1 ? "Holes" : n === 0 ? "Front 9" : "Back 9";
          return (
            <Card key={n} className="mb-4 overflow-x-auto">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                {label} · <TeeDot color={tee.color} /> {tee.name}
              </p>
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-xs text-slate-400">
                    <th className="font-medium text-left pb-1">Hole</th>
                    <th className="font-medium pb-1">Par</th>
                    <th className="font-medium pb-1">Yds</th>
                    <th className="font-medium pb-1" title="Printed hole handicap: 1 = hardest hole">
                      Hcp
                    </th>
                    <th className="font-medium pb-1" title="Average strokes on this hole across every round logged">
                      Avg
                    </th>
                    <th className="font-medium pb-1" title="Difficulty rank from the group's scoring, 1 = hardest">
                      Rank
                    </th>
                  </tr>
                </thead>
                <tbody className="text-center">
                  {nine.map((h, i) => {
                    const hs = holeStats[offset + i];
                    return (
                      <tr key={h.number} className="border-t border-slate-100">
                        <td className="py-1 text-left font-medium">{h.number}</td>
                        <td>{h.par}</td>
                        <td>{tee.yards[offset + i] ?? "—"}</td>
                        <td className="text-slate-500">{useW && h.strokeIndexW ? h.strokeIndexW : h.strokeIndex}</td>
                        <td className="font-semibold text-slate-900">{hs?.average ?? "—"}</td>
                        <td className="font-semibold">{hs?.difficultyRank ?? "—"}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-slate-300 font-semibold">
                    <td className="py-1 text-left">Total</td>
                    <td>{nine.reduce((s, h) => s + h.par, 0)}</td>
                    <td>{nine.reduce((s, _, i) => s + (tee.yards[offset + i] ?? 0), 0).toLocaleString()}</td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </Card>
          );
        })}
      <p className="text-xs text-slate-400 mb-4">
        Hcp is the scorecard's hole handicap{tee?.useWomenIndex ? " (women's row for this tee)" : ""}. Avg and Rank
        come from every score logged on the hole, ranked by strokes over par.
        {!hasHoleData && " No rounds logged here yet."}
      </p>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Course record</p>
        {overall ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-slate-400">Low</p>
                <p className="text-xl font-bold text-green-600 tabular-nums">{recordEntry?.total ?? overall.low}</p>
                <p className="text-xs text-slate-400">{formatVsPar((recordEntry?.total ?? overall.low) - par)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Average</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{overall.average}</p>
                <p className="text-xs text-slate-400">{formatVsPar(Math.round(overall.average - par))}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">High</p>
                <p className="text-xl font-bold text-red-600 tabular-nums">{overall.high}</p>
                <p className="text-xs text-slate-400">{formatVsPar(overall.high - par)}</p>
              </div>
            </div>
            {recordHolders.length > 0 && (
              <p className="text-center text-sm text-slate-600 mt-2">
                Held by <span className="font-semibold">{recordHolders.join(" & ")}</span>
              </p>
            )}
            <p className="text-center text-[11px] text-slate-400 mt-1">{overall.rounds} rounds logged</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">No complete 18-hole rounds logged here yet.</p>
        )}
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Top 5 scores</p>
        {topScores.length === 0 ? (
          <p className="text-sm text-slate-500">No complete 18-hole rounds logged here yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {topScores.map((entry, i) => {
              const player = playersById.get(entry.playerId);
              if (!player) return null;
              return (
                <li key={`${entry.roundId}-${entry.playerId}`}>
                  <Link to={`/round/${entry.roundId}`} className="flex items-center justify-between py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="text-slate-400 w-4">{i + 1}</span>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.color }} />
                      <span className="font-medium text-slate-800 text-sm">{player.name}</span>
                    </span>
                    <span className="text-right">
                      <span className="font-semibold tabular-nums text-sm">{entry.total}</span>{" "}
                      <span className="text-xs text-slate-400">({formatVsPar(entry.total - par)})</span>
                      <span className="block text-[11px] text-slate-400">{formatRoundDate(entry.date)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          By player (low / avg / high)
        </p>
        {playerRows.length === 0 ? (
          <p className="text-sm text-slate-500">No complete 18-hole rounds logged here yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {playerRows.map(({ player, stats }) => (
              <li key={player.id}>
                <Link to={`/stats/${player.id}`} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.color }} />
                    <span className="font-medium text-slate-800 text-sm">{player.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums">
                      <span className="text-green-600 font-semibold">{stats.low}</span>
                      {" / "}
                      <span className="text-slate-900 font-semibold">{stats.average}</span>
                      {" / "}
                      <span className="text-red-600 font-semibold">{stats.high}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">{stats.rounds} rounds</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!course.hideFromNewRound && (
        <LinkButton to={`/round/new?course=${course.id}`}>⛳ Play here</LinkButton>
      )}
    </div>
  );
}
