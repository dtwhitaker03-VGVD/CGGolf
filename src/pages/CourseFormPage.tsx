import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { Button, Card, Field, PageHeader, TeeDot, inputClass } from "../components/ui";
import type { Hole, Tee } from "../types";

const TEE_COLORS: Record<string, string> = {
  black: "#111827",
  blue: "#2563eb",
  white: "#e5e7eb",
  green: "#16a34a",
  gold: "#eab308",
  yellow: "#eab308",
  red: "#dc2626",
  orange: "#ea580c",
  silver: "#94a3b8",
};

function buildHoles(count: number, previous: Hole[]): Hole[] {
  return Array.from(
    { length: count },
    (_, i) => previous[i] ?? { number: i + 1, par: 4, strokeIndex: i + 1 },
  );
}

function numOrUndefined(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function CourseFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { courses, addCourse, updateCourse, deleteCourse } = useAppData();
  const existing = useMemo(() => courses.find((c) => c.id === id), [courses, id]);
  const isEdit = Boolean(existing);

  const [name, setName] = useState(existing?.name ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [holes, setHoles] = useState<Hole[]>(existing?.holes ?? buildHoles(18, []));
  const [tees, setTees] = useState<Tee[]>(
    existing?.tees ?? [{ name: "White", color: TEE_COLORS.white, yards: Array(18).fill(0) }],
  );
  const [hasWomenIndex, setHasWomenIndex] = useState(
    existing ? existing.holes.some((h) => h.strokeIndexW !== undefined) : false,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setHoleCount(count: number) {
    setHoles(buildHoles(count, holes));
    setTees(tees.map((t) => ({ ...t, yards: Array.from({ length: count }, (_, i) => t.yards[i] ?? 0) })));
  }

  function patchHole(i: number, patch: Partial<Hole>) {
    setHoles(holes.map((h, k) => (k === i ? { ...h, ...patch } : h)));
  }

  function patchTee(i: number, patch: Partial<Tee>) {
    setTees(tees.map((t, k) => (k === i ? { ...t, ...patch } : t)));
  }

  function patchYards(teeIndex: number, holeIndex: number, yards: number) {
    setTees(
      tees.map((t, k) =>
        k === teeIndex ? { ...t, yards: t.yards.map((y, h) => (h === holeIndex ? yards : y)) } : t,
      ),
    );
  }

  function validate(): string | null {
    if (!name.trim()) return "Give the course a name.";
    if (tees.length === 0) return "Add at least one tee.";
    const si = holes.map((h) => h.strokeIndex).sort((a, b) => a - b);
    if (si.some((v, i) => v !== i + 1)) {
      return `Hole handicaps (stroke indexes) must use each number 1–${holes.length} exactly once.`;
    }
    if (hasWomenIndex) {
      const w = holes.map((h) => h.strokeIndexW ?? 0).sort((a, b) => a - b);
      if (w.some((v, i) => v !== i + 1)) {
        return `Women's hole handicaps must use each number 1–${holes.length} exactly once.`;
      }
    }
    if (tees.some((t) => !t.name.trim())) return "Every tee needs a name.";
    if (tees.some((t) => (t.rating === undefined) !== (t.slope === undefined))) {
      return "A tee needs both a rating and a slope (or neither).";
    }
    return null;
  }

  async function handleSave() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const cleanHoles = holes.map((h) => ({
        number: h.number,
        par: h.par,
        strokeIndex: h.strokeIndex,
        ...(hasWomenIndex && h.strokeIndexW ? { strokeIndexW: h.strokeIndexW } : {}),
      }));
      const cleanTees = tees.map((t) => ({
        ...t,
        name: t.name.trim(),
        useWomenIndex: hasWomenIndex && t.useWomenIndex ? true : undefined,
      }));
      if (existing) {
        await updateCourse(existing.id, {
          name: name.trim(),
          location: location.trim() || undefined,
          holes: cleanHoles,
          tees: cleanTees,
        });
        navigate(`/courses/${existing.id}`);
      } else {
        const created = await addCourse({
          name: name.trim(),
          location: location.trim() || undefined,
          holes: cleanHoles,
          tees: cleanTees,
        });
        navigate(`/courses/${created.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the course.");
      setBusy(false);
    }
  }

  const totalPar = holes.reduce((s, h) => s + h.par, 0);

  return (
    <div>
      <PageHeader title={isEdit ? "Edit course" : "Add course"} />

      <Card className="space-y-3 mb-4">
        <Field label="Course name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Location (optional)">
          <input
            className={inputClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, ST"
          />
        </Field>
        <Field label="Number of holes">
          <div className="flex gap-2">
            {[9, 18].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setHoleCount(n)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border ${
                  holes.length === n
                    ? "bg-green-700 text-white border-green-700"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>
      </Card>

      <Card className="mb-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Holes · par {totalPar}
          </p>
          <label className="text-xs text-slate-500 flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={hasWomenIndex}
              onChange={(e) => {
                setHasWomenIndex(e.target.checked);
                if (e.target.checked) {
                  setHoles(holes.map((h) => ({ ...h, strokeIndexW: h.strokeIndexW ?? h.strokeIndex })));
                }
              }}
            />
            Women's hcp row
          </label>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="font-medium text-left pb-1">Hole</th>
              <th className="font-medium pb-1">Par</th>
              <th className="font-medium pb-1">Hcp</th>
              {hasWomenIndex && <th className="font-medium pb-1">Hcp (W)</th>}
            </tr>
          </thead>
          <tbody>
            {holes.map((h, i) => (
              <tr key={h.number} className="border-t border-slate-100">
                <td className="py-1 font-medium">{h.number}</td>
                <td className="text-center">
                  <select
                    className="rounded-lg border border-slate-300 px-1 py-1 text-base"
                    value={h.par}
                    onChange={(e) => patchHole(i, { par: Number(e.target.value) })}
                  >
                    {[3, 4, 5, 6].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </td>
                <td className="text-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={holes.length}
                    className="w-14 rounded-lg border border-slate-300 px-1 py-1 text-center text-base"
                    value={h.strokeIndex}
                    onChange={(e) => patchHole(i, { strokeIndex: Number(e.target.value) })}
                  />
                </td>
                {hasWomenIndex && (
                  <td className="text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={holes.length}
                      className="w-14 rounded-lg border border-slate-300 px-1 py-1 text-center text-base"
                      value={h.strokeIndexW ?? ""}
                      onChange={(e) => patchHole(i, { strokeIndexW: numOrUndefined(e.target.value) })}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-400 mt-2">
          Hcp is the scorecard's handicap row: 1 = hardest hole, {holes.length} = easiest.
        </p>
      </Card>

      {tees.map((tee, ti) => (
        <Card key={ti} className="mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              <TeeDot color={tee.color} /> Tee {ti + 1}
            </p>
            {tees.length > 1 && (
              <button
                type="button"
                className="text-xs text-red-600"
                onClick={() => setTees(tees.filter((_, k) => k !== ti))}
              >
                Remove tee
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input
                className={inputClass}
                value={tee.name}
                onChange={(e) => {
                  const color = TEE_COLORS[e.target.value.trim().toLowerCase()];
                  patchTee(ti, { name: e.target.value, ...(color ? { color } : {}) });
                }}
              />
            </Field>
            <Field label="Color">
              <input
                type="color"
                className="w-full h-[46px] rounded-xl border border-slate-300 p-1"
                value={tee.color}
                onChange={(e) => patchTee(ti, { color: e.target.value })}
              />
            </Field>
            <Field label="Course rating">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                className={inputClass}
                value={tee.rating ?? ""}
                onChange={(e) => patchTee(ti, { rating: numOrUndefined(e.target.value) })}
              />
            </Field>
            <Field label="Slope">
              <input
                type="number"
                inputMode="numeric"
                className={inputClass}
                value={tee.slope ?? ""}
                onChange={(e) => patchTee(ti, { slope: numOrUndefined(e.target.value) })}
              />
            </Field>
          </div>
          {hasWomenIndex && (
            <label className="text-sm text-slate-600 flex items-center gap-2">
              <input
                type="checkbox"
                checked={tee.useWomenIndex ?? false}
                onChange={(e) => patchTee(ti, { useWomenIndex: e.target.checked })}
              />
              Allocate strokes with the women's hcp row
            </label>
          )}
          <details>
            <summary className="text-sm font-medium text-green-700 cursor-pointer">
              Yardages ({tee.yards.reduce((s, y) => s + y, 0).toLocaleString()} yds)
            </summary>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {holes.map((h, hi) => (
                <label key={h.number} className="text-xs text-slate-500">
                  Hole {h.number}
                  <input
                    type="number"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-base text-slate-900"
                    value={tee.yards[hi] ?? 0}
                    onChange={(e) => patchYards(ti, hi, Number(e.target.value) || 0)}
                  />
                </label>
              ))}
            </div>
          </details>
        </Card>
      ))}

      <Button
        variant="secondary"
        className="w-full mb-4"
        onClick={() =>
          setTees([
            ...tees,
            { name: "", color: "#94a3b8", yards: Array.from({ length: holes.length }, () => 0) },
          ])
        }
      >
        + Add a tee
      </Button>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="space-y-2">
        <Button className="w-full" disabled={busy} onClick={handleSave}>
          {busy ? "Saving…" : "Save course"}
        </Button>
        {existing && (
          <Button
            variant="danger"
            className="w-full"
            onClick={async () => {
              if (confirm(`Delete ${existing.name} and every round played there?`)) {
                await deleteCourse(existing.id);
                navigate("/courses");
              }
            }}
          >
            Delete course
          </Button>
        )}
      </div>
    </div>
  );
}
