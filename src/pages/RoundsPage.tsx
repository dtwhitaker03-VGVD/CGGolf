import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { formatVsPar, playerResult, roundHolesLabel } from "../lib/golf";
import { Card, EmptyState, LinkButton, PageHeader } from "../components/ui";

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
                    <p className="text-sm text-slate-400">{round.date}</p>
                  </div>
                  {round.holes !== "all" && (
                    <p className="text-xs text-slate-400 mb-1">{roundHolesLabel(round.holes)}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {round.playerIds.map((pid) => {
                      const player = playersById.get(pid);
                      const r = playerResult(round, course, pid);
                      if (!r || !player) return null;
                      return (
                        <span key={pid}>
                          <span style={{ color: player.color }} className="font-medium">
                            {player.name}
                          </span>{" "}
                          <span className="tabular-nums text-slate-600">
                            {r.gross} ({formatVsPar(r.vsPar)})
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
