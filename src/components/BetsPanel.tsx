import { useState } from "react";
import type { BetType, NewBet, Player } from "../types";
import { describeBet, favRisk } from "../lib/bets";
import { Button, Card, Field, inputClass } from "./ui";

export interface BetLine {
  key: string;
  bet: NewBet;
  /** Status text (live margin, or the settled result). */
  status?: string;
}

/** "3-1", "3:1", "3" or "even"/blank -> how many dollars the favorite risks per $1 the underdog risks. */
export function parseOdds(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (t === "" || t === "even" || t === "evens" || t === "1-1") return 1;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(?:[-:/]\s*1)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 ? n : null;
}

const TYPE_LABEL: Record<BetType, string> = {
  straight: "Straight up (lowest score)",
  spread: "Spread (favorite gives strokes)",
  overunder: "Over / under a score",
};

export function BetsPanel({
  players,
  playerIds,
  bets,
  onAdd,
  onRemove,
  locked = false,
}: {
  players: Player[];
  playerIds: string[];
  bets: BetLine[];
  onAdd: (bet: NewBet) => Promise<void> | void;
  onRemove: (key: string) => Promise<void> | void;
  /** True once a bet can't change (not used for now; bets stay editable). */
  locked?: boolean;
}) {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name.split(" ")[0] ?? "?";
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<BetType>("straight");
  const [favId, setFavId] = useState(playerIds[0] ?? "");
  const [dogId, setDogId] = useState(playerIds[1] ?? "");
  const [line, setLine] = useState("");
  const [side, setSide] = useState<"under" | "over">("under");
  const [stake, setStake] = useState("1");
  const [odds, setOdds] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const favEff = playerIds.includes(favId) ? favId : (playerIds[0] ?? "");
  const others = playerIds.filter((id) => id !== favEff);
  const dogEff = others.includes(dogId) ? dogId : (others[0] ?? "");
  const oddsN = parseOdds(odds);
  const stakeN = Number(stake);
  const needsLine = type !== "straight";
  const lineN = Number(line);
  const preview =
    oddsN !== null && stakeN > 0 && favEff
      ? oddsN === 1
        ? `Even bet — $${stakeN} each`
        : `${nameOf(favEff)} risks $${favRisk({ stake: stakeN, favOdds: oddsN })} to win $${stakeN}; ${nameOf(dogEff)} risks $${stakeN} to win $${favRisk({ stake: stakeN, favOdds: oddsN })}`
      : "";

  async function submit() {
    setError(null);
    if (!favEff || !dogEff || favEff === dogEff) return setError("Pick two different players.");
    if (oddsN === null) return setError('Odds look like "3-1", or leave blank for even.');
    if (!(stakeN > 0)) return setError("Enter an amount.");
    if (needsLine && (line.trim() === "" || !Number.isFinite(lineN) || lineN < 0)) {
      return setError(type === "spread" ? "Enter how many strokes." : "Enter the score line.");
    }
    setBusy(true);
    try {
      await onAdd({
        type,
        favId: favEff,
        dogId: dogEff,
        line: needsLine ? lineN : undefined,
        side: type === "overunder" ? side : undefined,
        stake: stakeN,
        favOdds: oddsN,
      });
      setOpen(false);
      setLine("");
      setOdds("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add the bet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bets 💵</p>
        {!locked && playerIds.length >= 2 && (
          <button type="button" className="text-sm font-medium text-green-700" onClick={() => setOpen(!open)}>
            {open ? "Cancel" : "+ Add bet"}
          </button>
        )}
      </div>

      {bets.length === 0 && !open && <p className="text-sm text-slate-500">No bets on this round.</p>}
      <ul className="divide-y divide-slate-100">
        {bets.map((b) => (
          <li key={b.key} className="py-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-slate-800">{describeBet(b.bet, nameOf)}</p>
              {b.status && <p className="text-xs text-slate-500 mt-0.5">{b.status}</p>}
            </div>
            {!locked && (
              <button
                type="button"
                className="text-xs text-red-500 shrink-0"
                onClick={() => {
                  if (confirm("Remove this bet?")) void onRemove(b.key);
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {open && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <Field label="Bet type">
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as BetType)}>
              {(Object.keys(TYPE_LABEL) as BetType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Favorite">
              <select className={inputClass} value={favEff} onChange={(e) => setFavId(e.target.value)}>
                {playerIds.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
              </select>
            </Field>
            <Field label="Against">
              <select className={inputClass} value={dogEff} onChange={(e) => setDogId(e.target.value)}>
                {others.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
              </select>
            </Field>
          </div>
          {type === "spread" && (
            <Field label={`Strokes ${nameOf(favEff)} gives ${nameOf(dogEff)}`}>
              <input inputMode="decimal" className={inputClass} value={line} onChange={(e) => setLine(e.target.value)} placeholder="4" />
              <p className="text-xs text-slate-400 mt-1">Winning by exactly this many is a push. Use a half (4.5) to avoid pushes.</p>
            </Field>
          )}
          {type === "overunder" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label={`${nameOf(favEff)} takes`}>
                <select className={inputClass} value={side} onChange={(e) => setSide(e.target.value as "under" | "over")}>
                  <option value="under">Under</option>
                  <option value="over">Over</option>
                </select>
              </Field>
              <Field label="Score line">
                <input inputMode="decimal" className={inputClass} value={line} onChange={(e) => setLine(e.target.value)} placeholder="90" />
              </Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Underdog risks ($)">
              <input inputMode="decimal" className={inputClass} value={stake} onChange={(e) => setStake(e.target.value)} />
            </Field>
            <Field label="Odds (blank = even)">
              <input className={inputClass} value={odds} onChange={(e) => setOdds(e.target.value)} placeholder="3-1" />
            </Field>
          </div>
          {preview && <p className="text-xs text-slate-500">{preview}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" disabled={busy} onClick={() => void submit()}>
            {busy ? "Adding…" : "Add bet"}
          </Button>
        </div>
      )}
    </Card>
  );
}
