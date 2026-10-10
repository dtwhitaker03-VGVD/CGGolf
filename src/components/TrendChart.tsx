interface Point {
  date: string;
  value: number;
}

const WIDTH = 320;
const HEIGHT = 140;
const PAD_X = 8;
const PAD_Y = 16;

/** Simple line chart of a value over time (e.g. score differentials). */
export function TrendChart({ points, color, label }: { points: Point[]; color: string; label: string }) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-400 py-8 text-center">No rounds yet.</p>;
  }
  if (points.length === 1) {
    return (
      <div className="py-6 text-center">
        <p className="text-3xl font-bold tabular-nums" style={{ color }}>
          {points[0].value}
        </p>
        <p className="text-xs text-slate-400 mt-1">Play another round to see a trend.</p>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const stepX = (WIDTH - PAD_X * 2) / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_Y + (HEIGHT - PAD_Y * 2) * (1 - (p.value - min) / range),
  }));
  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={label}>
      <line x1={PAD_X} x2={WIDTH - PAD_X} y1={HEIGHT - PAD_Y} y2={HEIGHT - PAD_Y} stroke="#e2e8f0" strokeWidth={1} />
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 4 : 2.5} fill={color} />
      ))}
      <text x={PAD_X} y={12} fontSize={10} fill="#94a3b8">
        {max}
      </text>
      <text x={PAD_X} y={HEIGHT - 4} fontSize={10} fill="#94a3b8">
        {min}
      </text>
    </svg>
  );
}
