import { useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { computeScoreStats, courseTotalsByPlayer, holeDifficulty } from "../lib/stats";
import { Card, EmptyState, LinkButton, PageHeader } from "../components/ui";

export function CourseStatsPage() {
  const { id } = useParams();
  const { coursesById, playersById, rounds } = useAppData();
  const course = id ? coursesById.get(id) : undefined;

  if (!course) {
    return <EmptyState icon="📈" title="Course not found" action={<LinkButton to="/stats">Back to stats</LinkButton>} />;
  }

  const byPlayer = courseTotalsByPlayer(course, rounds);
  const holes = holeDifficulty(course, rounds);
  const hasHoleData = holes.some((h) => h.played > 0);
  const hardest = [...holes].filter((h) => h.played > 0).sort((a, b) => b.avgOverPar - a.avgOverPar);

  return (
    <div>
      <PageHeader title={course.name} subtitle="Group scoring (18-hole rounds)" />

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Low / average / high by player
        </p>
        {byPlayer.size === 0 ? (
          <p className="text-sm text-slate-400">No complete rounds here yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...byPlayer.entries()].map(([pid, totals]) => {
              const stats = computeScoreStats(totals)!;
              const player = playersById.get(pid);
              return (
                <li key={pid} className="py-2 flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: player?.color }}>
                    {player?.name}
                  </span>
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
        )}
      </Card>

      {hasHoleData && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Hardest holes (avg strokes over par)
          </p>
          <ul className="divide-y divide-slate-100 text-sm">
            {hardest.map((h) => (
              <li key={h.holeNumber} className="py-1.5 flex justify-between">
                <span className="text-slate-700">
                  Hole {h.holeNumber} <span className="text-slate-400">· par {h.par}</span>
                </span>
                <span className="tabular-nums font-semibold">
                  {h.avgOverPar > 0 ? `+${h.avgOverPar.toFixed(2)}` : h.avgOverPar.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
