import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { coursePar, teeYards } from "../lib/golf";
import { Card, EmptyState, LinkButton, PageHeader, TeeDot } from "../components/ui";

export function CourseDetailPage() {
  const { id } = useParams();
  const { coursesById } = useAppData();
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
  const nines = course.holes.length > 9 ? [course.holes.slice(0, 9), course.holes.slice(9)] : [course.holes];
  const useW = tee?.useWomenIndex;

  return (
    <div>
      <PageHeader
        title={course.name}
        subtitle={[course.location, `par ${coursePar(course)}`].filter(Boolean).join(" · ")}
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
                    <th className="font-medium pb-1" title="Stroke index: 1 = hardest hole">
                      Hcp
                    </th>
                  </tr>
                </thead>
                <tbody className="text-center">
                  {nine.map((h, i) => (
                    <tr key={h.number} className="border-t border-slate-100">
                      <td className="py-1 text-left font-medium">{h.number}</td>
                      <td>{h.par}</td>
                      <td>{tee.yards[offset + i] ?? "—"}</td>
                      <td className="text-slate-500">
                        {useW && h.strokeIndexW ? h.strokeIndexW : h.strokeIndex}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-300 font-semibold">
                    <td className="py-1 text-left">Total</td>
                    <td>{nine.reduce((s, h) => s + h.par, 0)}</td>
                    <td>
                      {nine.reduce((s, _, i) => s + (tee.yards[offset + i] ?? 0), 0).toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </Card>
          );
        })}
      {tee?.useWomenIndex && (
        <p className="text-xs text-slate-400 mb-4">
          Hcp column uses this tee's women's stroke indexes.
        </p>
      )}

      <LinkButton to={`/round/new?course=${course.id}`}>⛳ Play here</LinkButton>
    </div>
  );
}
