import { Link, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { playerIndex } from "../lib/players";
import {
  coursePar,
  formatIndex,
  formatRoundDate,
  formatVsPar,
  playerDifferentials,
  playerResult,
  roundHolesLabel,
  type HoleCounts,
} from "../lib/golf";
import {
  computeScoreStats,
  playerBestHolesByCourse,
  playerCourseRelToPar,
  playerHoleCounts,
  playerHoleCountsByCourse,
  playerTotalsByCourse,
  playerWorstHolesByCourse,
  MIN_ROUNDS_FOR_HOLE_SUPERLATIVE,
  type HoleRelStat,
  type ScoreStats,
} from "../lib/stats";
import { roundTags } from "../components/RoundSummary";
import { Card, EmptyState, LinkButton, PageHeader } from "../components/ui";
import { TrendChart } from "../components/TrendChart";
import type { Course } from "../types";

function Count({ n, label, className = "" }: { n: number; label: string; className?: string }) {
  return (
    <div>
      <p className={`text-xl font-bold tabular-nums ${className}`}>{n}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

function HoleLine({ kind, stat, color }: { kind: string; stat: HoleRelStat; color: string }) {
  return (
    <p className="text-[11px] text-slate-400">
      {kind} hole: #{stat.holeNumber} (par {stat.par}) ·{" "}
      <span className={`font-medium ${color}`}>{formatVsPar(stat.avgRelToPar)}</span> avg
    </p>
  );
}

export function PlayerStatsPage() {
  const { id } = useParams();
  const { playersById, rounds, coursesById } = useAppData();
  const player = id ? playersById.get(id) : undefined;

  if (!player) {
    return <EmptyState icon="📈" title="Player not found" action={<LinkButton to="/stats">Back to stats</LinkButton>} />;
  }

  const idx = playerIndex(player, rounds, coursesById);
  const diffs = playerDifferentials(player.id, rounds, coursesById).sort((a, b) => (a.date < b.date ? -1 : 1));

  const playerRounds = rounds
    .filter((r) => r.playerIds.includes(player.id) && coursesById.has(r.courseId))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // Best course: lowest average relative to par, ties to whoever has more rounds there, then by name.
  const courseRel = playerCourseRelToPar(player.id, rounds, coursesById);
  const bestCourseStat = [...courseRel].sort((a, b) => {
    if (a.avgRelToPar !== b.avgRelToPar) return a.avgRelToPar - b.avgRelToPar;
    if (a.roundsPlayed !== b.roundsPlayed) return b.roundsPlayed - a.roundsPlayed;
    return (coursesById.get(a.courseId)?.name ?? "").localeCompare(coursesById.get(b.courseId)?.name ?? "");
  })[0];
  const bestCourse = bestCourseStat ? coursesById.get(bestCourseStat.courseId) : undefined;

  const lifetime = playerHoleCounts(player.id, rounds, coursesById);
  const totalsByCourse = playerTotalsByCourse(player.id, rounds, coursesById);
  const countsByCourse = playerHoleCountsByCourse(player.id, rounds, coursesById);
  const bestHoles = playerBestHolesByCourse(player.id, rounds, coursesById);
  const worstHoles = playerWorstHolesByCourse(player.id, rounds, coursesById);

  // Every course with any recorded holes gets a row; low / avg / high need complete 18-hole rounds.
  const courseRows = [...countsByCourse.entries()]
    .map(([courseId, counts]) => {
      const course = coursesById.get(courseId);
      if (!course) return null;
      const totals = totalsByCourse.get(courseId);
      return {
        course,
        counts,
        stats: totals ? computeScoreStats(totals) : null,
        roundsAtCourse: playerRounds.filter((r) => r.courseId === courseId).length,
      };
    })
    .filter(
      (r): r is { course: Course; counts: HoleCounts; stats: ScoreStats | null; roundsAtCourse: number } =>
        Boolean(r),
    )
    .sort((a, b) => a.course.name.localeCompare(b.course.name));

  return (
    <div>
      <PageHeader title={player.name} subtitle={player.isSelf ? "You" : "Friend"} />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card>
          <p className="text-xs text-slate-400 mb-1">Handicap index</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: player.color }}>
            {formatIndex(idx.current)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {idx.calculated !== null
              ? `Best of ${Math.min(idx.rounds, 20)} recent rounds`
              : `${idx.rounds} of 3 rounds needed`}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400 mb-1">Rounds logged</p>
          <p className="text-2xl font-bold tabular-nums">{playerRounds.length}</p>
        </Card>
      </div>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Best course</p>
        {bestCourse && bestCourseStat ? (
          <Link to={`/courses/${bestCourse.id}`} className="flex items-center justify-between">
            <p className="font-semibold text-slate-900 text-sm">{bestCourse.name}</p>
            <p className="text-right">
              <span className="text-lg font-bold tabular-nums" style={{ color: player.color }}>
                {bestCourseStat.avgRelToPar === 0
                  ? "E"
                  : bestCourseStat.avgRelToPar > 0
                    ? `+${bestCourseStat.avgRelToPar}`
                    : bestCourseStat.avgRelToPar}
              </span>{" "}
              <span className="text-[11px] text-slate-400">
                avg · {bestCourseStat.roundsPlayed} round{bestCourseStat.roundsPlayed === 1 ? "" : "s"}
              </span>
            </p>
          </Link>
        ) : (
          <p className="text-sm text-slate-400">—</p>
        )}
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Score differentials</p>
        <TrendChart
          points={diffs.map((d) => ({ date: d.date, value: d.value }))}
          color={player.color}
          label="Score differential per round"
        />
        <p className="text-[11px] text-slate-400 mt-1">Lower is better. Each point is one 18-hole round.</p>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Lifetime hole scores</p>
        <div className="grid grid-cols-4 gap-3 text-center">
          <Count n={lifetime.aces} label="Aces" />
          <Count n={lifetime.eagles} label="Eagles" className="text-green-700" />
          <Count n={lifetime.birdies} label="Birdies" className="text-green-600" />
          <Count n={lifetime.pars} label="Pars" />
          <Count n={lifetime.bogeys} label="Bogeys" className="text-amber-600" />
          <Count n={lifetime.doubleBogeys} label="Double bogeys" className="text-red-600" />
          <Count n={lifetime.triplePlus} label="Triple+ bogeys" className="text-red-700" />
        </div>
        <p className="text-center text-[11px] text-slate-400 mt-3">{lifetime.holesPlayed} holes played</p>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">By course</p>
        {courseRows.length === 0 ? (
          <p className="text-sm text-slate-500">No rounds logged yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {courseRows.map(({ course, counts, stats, roundsAtCourse }) => {
              const par = coursePar(course);
              const best = bestHoles.get(course.id);
              const worst = worstHoles.get(course.id);
              return (
                <li key={course.id}>
                  <Link to={`/courses/${course.id}`} className="block py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-800 text-sm">
                        {course.name}{" "}
                        <span className="text-[11px] text-slate-400 font-normal">
                          · {roundsAtCourse} round{roundsAtCourse === 1 ? "" : "s"}
                        </span>
                      </p>
                      {stats ? (
                        <p className="text-sm tabular-nums text-right shrink-0">
                          <span className="text-green-600 font-semibold">
                            {stats.low} ({formatVsPar(stats.low - par)})
                          </span>
                          {" / "}
                          <span className="text-slate-900 font-semibold">{stats.average}</span>
                          {" / "}
                          <span className="text-red-600 font-semibold">
                            {stats.high} ({formatVsPar(stats.high - par)})
                          </span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 shrink-0">no complete 18s yet</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mt-1">
                      <span className="text-slate-500">{counts.aces} Ace</span>
                      <span className="text-green-700">{counts.eagles} Eagle</span>
                      <span className="text-green-600">{counts.birdies} Birdie</span>
                      <span className="text-slate-500">{counts.pars} Par</span>
                      <span className="text-amber-600">{counts.bogeys} Bogey</span>
                      <span className="text-red-600">{counts.doubleBogeys} Dbl</span>
                      <span className="text-red-700">{counts.triplePlus} Tpl+</span>
                    </div>
                    {best && <HoleLine kind="Best" stat={best} color="text-green-600" />}
                    {worst && <HoleLine kind="Worst" stat={worst} color="text-red-600" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-slate-400 mt-2">
          Best and worst hole need {MIN_ROUNDS_FOR_HOLE_SUPERLATIVE}+ scores on that hole.
        </p>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Round history</p>
        {playerRounds.length === 0 ? (
          <p className="text-sm text-slate-500">No rounds yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {playerRounds.map((r) => {
              const course = coursesById.get(r.courseId)!;
              const res = playerResult(r, course, player.id);
              if (!res) return null;
              const left = r.droppedPlayers?.[player.id];
              return (
                <li key={r.id}>
                  <Link to={`/round/${r.id}`} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{course.name}</p>
                      <p className="text-xs text-slate-400">
                        {formatRoundDate(r.date)}
                        {r.holes !== "all" && ` · ${roundHolesLabel(r.holes)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums text-sm">
                        {res.gross} ({formatVsPar(res.vsPar)})
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {left !== undefined ? `Left after hole ${left}` : roundTags(r)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
