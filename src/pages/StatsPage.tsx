import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { playerIndex } from "../lib/players";
import { coursePar, formatIndex } from "../lib/golf";
import { computeScoreStats, courseTotalsByPlayer } from "../lib/stats";
import { Card, EmptyState, PageHeader } from "../components/ui";

export function StatsPage() {
  const { players, courses, rounds, coursesById } = useAppData();

  if (players.length === 0) {
    return (
      <div>
        <PageHeader title="Stats" />
        <EmptyState icon="📈" title="Add players to see stats" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Stats"
        subtitle="Tap a player for their handicap trend"
        action={<Link to="/money" className="text-sm font-medium text-green-700">💵 Money</Link>}
      />
      <div className="space-y-2">
        {players.map((player) => {
          const idx = playerIndex(player, rounds, coursesById);
          return (
            <Link key={player.id} to={`/stats/${player.id}`} className="block">
              <Card className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.color }} />
                  <span className="font-medium text-slate-800">{player.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatIndex(idx.current)}</p>
                  <p className="text-[11px] text-slate-400">{idx.rounds} counting round{idx.rounds === 1 ? "" : "s"}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {courses.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-6 mb-2">Courses</h2>
          <div className="space-y-2">
            {courses.map((course) => {
              const stats = computeScoreStats([...courseTotalsByPlayer(course, rounds).values()].flat());
              return (
                <Link key={course.id} to={`/courses/${course.id}`} className="block">
                  <Card className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{course.name}</p>
                      <p className="text-sm text-slate-400">
                        {course.holes.length} holes · par {coursePar(course)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {stats ? (
                          <>
                            <span className="text-green-600">{stats.low}</span>
                            {" / "}
                            <span className="text-slate-900">{stats.average}</span>
                            {" / "}
                            <span className="text-red-600">{stats.high}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {stats ? `${stats.rounds} rounds` : "No rounds yet"}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <p className="text-center text-xs text-slate-400 mt-6">
        <Link to="/about-handicaps" className="underline">
          How are handicaps calculated?
        </Link>
      </p>
    </div>
  );
}
