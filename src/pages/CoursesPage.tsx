import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { coursePar, teeYards } from "../lib/golf";
import { computeScoreStats, courseTotalsByPlayer } from "../lib/stats";
import { Card, EmptyState, LinkButton, PageHeader, TeeDot } from "../components/ui";

export function CoursesPage() {
  const { courses, rounds } = useAppData();

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle="Tap a course for its scorecard"
        action={
          <Link
            to="/courses/new"
            className="rounded-xl bg-green-700 text-white px-3 py-2 text-sm font-semibold"
          >
            + Add
          </Link>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          icon="⛳"
          title="No courses yet"
          subtitle="Add the courses you play so you can quickly start a round."
          action={<LinkButton to="/courses/new">Add your first course</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const stats = computeScoreStats(
              [...courseTotalsByPlayer(course, rounds).values()].flat(),
            );
            const longest = course.tees[0];
            return (
              <Link key={course.id} to={`/courses/${course.id}`} className="block">
                <Card>
                  <p className="font-semibold text-slate-900">{course.name}</p>
                  {course.location && <p className="text-sm text-slate-500">{course.location}</p>}
                  <p className="text-sm text-slate-400 mt-1">
                    {course.holes.length} holes · par {coursePar(course)}
                    {longest && ` · ${teeYards(longest, course).toLocaleString()} yds`}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                    {course.tees.map((t) => (
                      <span key={t.name} className="inline-flex items-center gap-1">
                        <TeeDot color={t.color} />
                        {t.name}
                        {t.rating !== undefined && t.slope !== undefined && (
                          <span className="text-slate-400 tabular-nums">
                            {t.rating}/{t.slope}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm mt-2 tabular-nums">
                    {stats ? (
                      <>
                        <span className="text-green-600 font-semibold">{stats.low}</span>
                        {" / "}
                        <span className="text-slate-900 font-semibold">{stats.average}</span>
                        {" / "}
                        <span className="text-red-600 font-semibold">{stats.high}</span>
                        <span className="text-slate-400 text-xs"> low / avg / high</span>
                      </>
                    ) : (
                      <span className="text-slate-400">No rounds yet</span>
                    )}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
