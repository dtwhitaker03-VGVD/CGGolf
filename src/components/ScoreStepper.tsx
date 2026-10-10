export function ScoreStepper({
  value,
  par,
  strokes = 0,
  onChange,
}: {
  value: number;
  par: number;
  /** Handicap strokes the player receives on this hole (shown as dots). */
  strokes?: number;
  onChange: (next: number) => void;
}) {
  const diff = value - par;
  const diffColor = diff < 0 ? "text-blue-600" : diff === 0 ? "text-slate-500" : "text-red-600";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Decrease score"
        className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 text-xl font-bold active:bg-slate-200 disabled:opacity-30"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        −
      </button>
      <div className="w-12 text-center">
        <div className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{value}</div>
        <div className={`text-[11px] font-medium tabular-nums ${diffColor}`}>
          {diff === 0 ? "E" : diff > 0 ? `+${diff}` : diff}
          {strokes > 0 && <span className="text-green-700"> {"•".repeat(Math.min(strokes, 3))}</span>}
        </div>
      </div>
      <button
        type="button"
        aria-label="Increase score"
        className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 text-xl font-bold active:bg-slate-200"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
