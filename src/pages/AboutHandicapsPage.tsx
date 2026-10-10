import { Card, PageHeader } from "../components/ui";

export function AboutHandicapsPage() {
  return (
    <div>
      <PageHeader title="How handicaps work" subtitle="Modeled on the World Handicap System" />

      <div className="space-y-3 text-sm text-slate-700">
        <Card>
          <p className="font-semibold text-slate-900 mb-1">Score differential</p>
          <p>
            Each complete 18-hole round from a <strong>rated tee</strong> becomes a differential:
            <br />
            <code>(adjusted gross − course rating) × 113 ÷ slope</code>
          </p>
          <p className="mt-2">
            <strong>Adjusted gross</strong> caps every hole at <em>net double bogey</em> (par + 2 + any
            handicap strokes you get on that hole), so one blow-up hole doesn't wreck your number. If you
            have no handicap yet, holes are capped at par + 5. Picked up? Write down your cap score.
          </p>
        </Card>
        <Card>
          <p className="font-semibold text-slate-900 mb-1">Handicap index</p>
          <p>
            Once you have 3 differentials the app averages your best ones from your most recent 20 rounds
            (1 of 3, 2 of 6, 3 of 9, 4 of 12, 5 of 15, 6 of 17, 8 of 20), with the WHS adjustment for very few
            rounds. Until then, a <em>starting index</em> you enter under Friends is used.
          </p>
        </Card>
        <Card>
          <p className="font-semibold text-slate-900 mb-1">Strokes you get</p>
          <p>
            <code>course handicap = index × slope ÷ 113 + (course rating − par)</code>, rounded. Strokes go to
            the hardest holes first using each scorecard's hole handicap row. Nine-hole rounds get half.
          </p>
          <p className="mt-2">
            In a <strong>Handicapped</strong> round (and best ball / team total with strokes on) scores are compared net. <strong>Scramble</strong> rounds and rounds where someone left early don't count toward an index. <strong>Stableford</strong> gives 2 points for a net par, 3
            for a birdie, 4 for an eagle, 1 for a bogey and 0 for worse.
          </p>
        </Card>
        <Card>
          <p className="font-semibold text-slate-900 mb-1">What's different from an official index</p>
          <p>
            This is a friendly-games estimate. It doesn't apply the daily playing-conditions adjustment,
            the soft/hard caps on index movement, or a 9-hole-round differential — and it isn't a
            USGA/GHIN-authorized index. For tournaments, use your official GHIN number.
          </p>
        </Card>
      </div>
    </div>
  );
}
