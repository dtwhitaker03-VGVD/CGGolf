import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { balances, evaluateSaved, ledgerFromBets, lifetimeTotals } from "../lib/bets";
import { formatRoundDate } from "../lib/golf";
import { Button, Card, Field, PageHeader, inputClass } from "../components/ui";

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function MoneyPage() {
  const { players, playersById, rounds, bets, payments, coursesById, addPayment, deletePayment } = useAppData();
  const first = (id: string) => playersById.get(id)?.name.split(" ")[0] ?? "?";

  const ledger = useMemo(() => ledgerFromBets(bets, rounds, coursesById), [bets, rounds, coursesById]);
  const owed = useMemo(() => balances(ledger, payments), [ledger, payments]);
  const totals = useMemo(() => lifetimeTotals(ledger), [ledger]);
  const roundsById = useMemo(() => new Map(rounds.map((r) => [r.id, r])), [rounds]);

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(from: string, to: string, amt: number) {
    setBusy(true);
    setError(null);
    try {
      await addPayment({ fromId: from, toId: to, amount: amt });
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the payment.");
    } finally {
      setBusy(false);
    }
  }

  // Everything that happened, newest first: settled bets, pushes/voids, and payments.
  const history = useMemo(() => {
    const items: { key: string; date: string; sortKey: string; text: string; sub?: string; link?: string; paymentId?: string }[] = [];
    for (const bet of bets) {
      const round = roundsById.get(bet.roundId);
      if (!round) continue;
      const r = evaluateSaved(bet, round, coursesById.get(round.courseId));
      const course = coursesById.get(round.courseId)?.name ?? "";
      const when = `${formatRoundDate(round.date)} · ${course}`;
      const sortKey = (round.date || "0000") + round.createdAt;
      if (r.status === "win") {
        items.push({ key: bet.id, date: round.date, sortKey, text: `${first(r.winnerId)} won ${money(r.amount)} from ${first(r.loserId)}`, sub: when, link: `/round/${round.id}` });
      } else {
        items.push({ key: bet.id, date: round.date, sortKey, text: `${first(bet.favId)} vs ${first(bet.dogId)} — ${r.status === "push" ? "push" : "void"}`, sub: when, link: `/round/${round.id}` });
      }
    }
    for (const p of payments) {
      items.push({
        key: p.id,
        date: p.createdAt.slice(0, 10),
        sortKey: p.createdAt,
        text: `${first(p.fromId)} paid ${first(p.toId)} ${money(p.amount)}`,
        sub: formatRoundDate(p.createdAt.slice(0, 10)),
        paymentId: p.id,
      });
    }
    return items.sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bets, payments, roundsById, coursesById, playersById]);

  const standings = players
    .filter((p) => totals.has(p.id))
    .map((p) => ({ p, total: totals.get(p.id) ?? 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <PageHeader title="Money" subtitle="Who owes who, from bets on rounds" />

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Who owes who</p>
        {owed.length === 0 ? (
          <p className="text-sm text-slate-500">All square. 🙌</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {owed.map((b) => (
              <li key={`${b.debtorId}-${b.creditorId}`} className="py-2.5 flex items-center justify-between gap-2">
                <p className="text-sm text-slate-800">
                  <span className="font-semibold">{first(b.debtorId)}</span> owes{" "}
                  <span className="font-semibold">{first(b.creditorId)}</span>{" "}
                  <span className="font-bold tabular-nums">{money(b.amount)}</span>
                </p>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs font-medium text-green-700 shrink-0"
                  onClick={() => {
                    if (confirm(`Mark ${first(b.debtorId)} as paid ${first(b.creditorId)} ${money(b.amount)}?`)) {
                      void pay(b.debtorId, b.creditorId, b.amount);
                    }
                  }}
                >
                  Settle up
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Lifetime winnings</p>
        {standings.length === 0 ? (
          <p className="text-sm text-slate-500">
            No settled bets yet. Add bets from a round's page or while scoring.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {standings.map(({ p, total }) => (
              <li key={p.id} className="py-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </span>
                <span className={`font-bold tabular-nums ${total > 0 ? "text-green-600" : total < 0 ? "text-red-600" : "text-slate-500"}`}>
                  {total > 0 ? "+" : total < 0 ? "−" : ""}{money(Math.abs(total))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-400 mt-2">Total won minus lost on bets. Payments don't change this.</p>
      </Card>

      <Card className="mb-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Record a payment</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Paid by">
            <select className={inputClass} value={fromId} onChange={(e) => setFromId(e.target.value)}>
              <option value="">Choose…</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Paid to">
            <select className={inputClass} value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">Choose…</option>
              {players.filter((p) => p.id !== fromId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Amount ($)">
          <input inputMode="decimal" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5" />
        </Field>
        <Button
          className="w-full"
          disabled={busy || !fromId || !toId || !(Number(amount) > 0)}
          onClick={() => void pay(fromId, toId, Number(amount))}
        >
          Save payment
        </Button>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">History</p>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.key} className="py-2.5 flex items-start justify-between gap-2">
                <div>
                  {h.link ? (
                    <Link to={h.link} className="text-sm text-slate-800">{h.text}</Link>
                  ) : (
                    <p className="text-sm text-slate-800">{h.text}</p>
                  )}
                  {h.sub && <p className="text-xs text-slate-400">{h.sub}</p>}
                </div>
                {h.paymentId && (
                  <button
                    type="button"
                    className="text-xs text-red-500 shrink-0"
                    onClick={() => {
                      if (confirm("Delete this payment?")) void deletePayment(h.paymentId!);
                    }}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
