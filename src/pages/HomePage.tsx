import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { useAuth } from "../store/AuthContext";
import { playerIndex } from "../lib/players";
import { formatIndex, formatRoundDate } from "../lib/golf";
import { Card, EmptyState, LinkButton, PageHeader } from "../components/ui";
import { IosInstallHint } from "../components/IosInstallHint";
import { RoundSummary, roundTags } from "../components/RoundSummary";

export function HomePage() {
  const { players, rounds, courses, coursesById, playersById } = useAppData();
  const { session, signOut } = useAuth();

  const standings = players
    .map((p) => ({ player: p, idx: playerIndex(p, rounds, coursesById) }))
    .sort((a, b) => {
      if (a.idx.current === null && b.idx.current === null) return 0;
      if (a.idx.current === null) return 1;
      if (b.idx.current === null) return -1;
      return a.idx.current - b.idx.current;
    });

  const lastRound = [...rounds].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const lastCourse = lastRound ? coursesById.get(lastRound.courseId) : undefined;

  return (
    <div>
      <PageHeader
        title="QWFGolf"
        subtitle="Your golf rounds, scores & handicap"
        action={
          <button
            type="button"
            onClick={() => signOut()}
            className="text-xs text-slate-400 underline"
            title={session?.user.email}
          >
            Sign out
          </button>
        }
      />

      <IosInstallHint />

      <LinkButton to="/round/new" className="text-lg py-5 mb-2">
        ⛳ New round
      </LinkButton>
      <p className="text-center text-sm mb-4">
        <Link to="/money" className="text-green-700 font-medium">
          💵 Money
        </Link>
        <span className="text-slate-300"> · </span>
        <Link to="/courses/new" className="text-slate-500 font-medium">
          + Add course
        </Link>
      </p>

      {lastRound && lastCourse && (
        <Card className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Last round
          </p>
          <Link to={`/round/${lastRound.id}`} className="block">
            <p className="font-semibold text-slate-900">{lastCourse.name}</p>
            <p className="text-sm text-slate-500">{formatRoundDate(lastRound.date)}</p>
            <p className="text-xs text-slate-400 mb-1.5">{roundTags(lastRound)}</p>
            <RoundSummary round={lastRound} course={lastCourse} playersById={playersById} />
          </Link>
        </Card>
      )}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Handicap index
        </p>
        {players.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No players yet"
            subtitle="Add your friends to start tracking handicaps together."
            action={<LinkButton to="/players">Add players</LinkButton>}
          />
        ) : rounds.length === 0 && standings.every((s) => s.idx.current === null) ? (
          <p className="text-sm text-slate-500">
            Play 3 complete 18-hole rounds from rated tees to get a handicap index. Already have one? Enter it
            under Friends.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {standings.map(({ player, idx }, i) => (
              <li key={player.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm text-slate-400 w-4">{i + 1}</span>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.color }} />
                  <span className="font-medium text-slate-800">
                    {player.name}
                    {player.isSelf ? " (you)" : ""}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{formatIndex(idx.current)}</div>
                  <div className="text-[11px] text-slate-400">
                    {`${idx.rounds} round${idx.rounds === 1 ? "" : "s"}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {rounds.length > 0 && (
        <p className="text-center text-sm mt-4">
          <Link to="/rounds" className="text-green-700 font-medium">
            View all rounds →
          </Link>
        </p>
      )}

      <p className="text-center text-[11px] text-slate-300 mt-8">Build {__APP_BUILD__}</p>

      {courses.length === 0 && (
        <p className="text-center text-sm text-slate-400 mt-6">
          Tip: add your local courses first so rounds are quick to log.
        </p>
      )}
    </div>
  );
}
