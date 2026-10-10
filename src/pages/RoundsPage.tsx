import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { Card, EmptyState, LinkButton, PageHeader } from "../components/ui";
import { RoundSummary, roundTags } from "../components/RoundSummary";
import { formatRoundDate } from "../lib/golf";

export function RoundsPage() {
  const { rounds, coursesById, playersById } = useAppData();
  const sorted = [...rounds].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <PageHeader title="Round history" />

      {sorted.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No rounds logged yet"
          action={<LinkButton to="/round/new">Log your first round</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((round) => {
            const course = coursesById.get(round.courseId);
            if (!course) return null;
            return (
              <Link key={round.id} to={`/round/${round.id}`} className="block">
                <Card>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-slate-900">{course.name}</p>
                    <p className="text-sm text-slate-400">{formatRoundDate(round.date)}</p>
                  </div>
                  <p className="text-xs text-slate-400 mb-1.5">{roundTags(round)}</p>
                  <RoundSummary round={round} course={course} playersById={playersById} />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
