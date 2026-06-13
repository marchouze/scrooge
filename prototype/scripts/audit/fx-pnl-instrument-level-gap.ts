// scripts/audit/fx-pnl-instrument-level-gap.ts
//
// READ-ONLY diagnostic quantification for D-FX-PNL-INSTRUMENT-LEVEL-VALUATION.
//
// Quantifies, against the canonical event store, the two FX-P&L defects the
// CEO brief asked Bea to confirm:
//
//   (A) IAS 21 §23(a) frozen-FCY retranslation gap — settled FX positions are
//       dropped from EOD revaluation (fx-revaluation.ts Step 2) but RETAINED
//       in the NOP / VaR basis (limit-utilisation.ts deriveNetFxPositionByCurrency).
//       So the held FCY nostro is frozen at its settlement-date ZAR value and
//       the post-settlement translation P&L is never recognised in the GL.
//
//   (B) Realised/unrealised double-count — PR-FX-002 accrues unrealised
//       (revalRate − bookRate)×notional to fx.receivable/fx.unrealised_pnl on
//       each FxPositionRevalued, while PR-FX-LIFECYCLE-CLOSE posts realised
//       (settlementRate − bookRate)×notional to fx.nostro/fx.realised_pnl on
//       SettlementConfirmed — BOTH measured from the SAME original bookRate,
//       to DIFFERENT accounts, with NO reversal of the accrued unrealised. The
//       trade-date→settlement move is therefore recognised twice.
//
// This script appends NOTHING. It only replays and prints. Run:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/audit/fx-pnl-instrument-level-gap.ts
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-FX-PNL-INSTRUMENT-LEVEL-VALUATION (CEO-approved 2026-06-13).

import "../../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../../platform/composition";
import type { FxPositionRevaluedPayload } from "../../platform/event-store/event-types/fx-accounting";
import type { FxTradeExecutedPayload } from "../../platform/markets/cdm/fx";
import { baseAmountMinor } from "../../platform/markets/cdm/fx-helpers";

interface TradeView {
  tradeId: string;
  pair: string;
  side: string;
  bookRate: number;
  baseNotionalMinor: number;
  settled: boolean;
  settledDate?: string;
  realisedPnlDelta?: number; // ZAR minor, from SettlementConfirmed
  lastRevalRate?: number;
  lastRevalUnrealisedMinor?: number; // signed ZAR minor accrued
  revalCount: number;
}

function pairStr(p: { base: string; quote: string }): string {
  return `${p.base}/${p.quote}`;
}

const trades = new Map<string, TradeView>();

// --- FxTradeExecuted: book the trade ------------------------------------
for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
  const p = e.payload as unknown as FxTradeExecutedPayload;
  const id = typeof p.tradeId === "string" ? p.tradeId : p.tradeId.value;
  const nearLeg = p.legs.find((l) => l.legKind === "near") ?? p.legs[0];
  if (!nearLeg) continue;
  trades.set(id, {
    tradeId: id,
    pair: pairStr(p.currencyPair),
    side: p.side,
    bookRate: nearLeg.rate.amount,
    baseNotionalMinor: Math.abs(baseAmountMinor(nearLeg, p.currencyPair)),
    settled: false,
    revalCount: 0,
  });
}

// --- SettlementConfirmed: mark settled + capture realisedPnlDelta -------
for (const e of eventStore.replay({ type: "SettlementConfirmed" })) {
  const p = e.payload as {
    tradeId?: unknown;
    settledDate?: string;
    realisedPnlDelta?: number;
  };
  const id = typeof p.tradeId === "string" ? p.tradeId : undefined;
  if (!id) continue;
  const t = trades.get(id);
  if (!t) continue;
  t.settled = true;
  t.settledDate = p.settledDate;
  // Only the FIRST settlement carries realised; later events keep the first.
  if (t.realisedPnlDelta === undefined) t.realisedPnlDelta = p.realisedPnlDelta ?? 0;
}

// --- FxPositionRevalued: capture last reval rate + accrued unrealised ----
for (const e of eventStore.replay({ type: "FxPositionRevalued" })) {
  const p = e.payload as unknown as FxPositionRevaluedPayload;
  const t = trades.get(p.tradeId);
  if (!t) continue;
  t.revalCount += 1;
  // Latest by as_of (events replay in sequence ~ chronological; take last seen).
  t.lastRevalRate = p.revalRate;
  t.lastRevalUnrealisedMinor = p.unrealisedPnlZarMinor;
}

// --- RealisedPnlRecognised (the CORRECT instrument-level path) -----------
let realisedRecognisedCount = 0;
let realisedRecognisedSumMinor = 0;
for (const e of eventStore.replay({ type: "RealisedPnlRecognised" })) {
  const p = e.payload as { realisedPnlZarMinor?: number };
  realisedRecognisedCount += 1;
  realisedRecognisedSumMinor += p.realisedPnlZarMinor ?? 0;
}

// ---------------------------------------------------------------------------
// (A) Frozen-FCY retranslation gap
// ---------------------------------------------------------------------------
// For each SETTLED trade that has at least one prior revaluation, the held FCY
// is frozen at its settlement-date ZAR value. The unrecognised translation P&L
// is the move between the rate at which the GL last carried the position and a
// current closing rate. We DO NOT have a post-settlement closing rate in the
// store (because revaluation drops settled trades — that IS the defect), so we
// quantify the gap two ways:
//   A1. Magnitude of accrued unrealised on settled trades that is NOT reversed
//       and may persist frozen on fx.receivable (the stranded carrying value).
//   A2. Count + base-notional of settled FCY positions that are in the NOP/VaR
//       basis but receive zero ongoing retranslation (the exposure that is
//       marked for risk but frozen for accounting).

const settled = [...trades.values()].filter((t) => t.settled);
const settledWithReval = settled.filter((t) => t.revalCount > 0);

const strandedAccruedMinor = settledWithReval.reduce(
  (acc, t) => acc + (t.lastRevalUnrealisedMinor ?? 0),
  0,
);

let settledBaseNotionalMinor = 0n;
const settledByCcy = new Map<string, number>();
for (const t of settled) {
  settledBaseNotionalMinor += BigInt(t.baseNotionalMinor);
  const base = t.pair.split("/")[0] ?? "?";
  settledByCcy.set(base, (settledByCcy.get(base) ?? 0) + t.baseNotionalMinor);
}

// ---------------------------------------------------------------------------
// (B) Double-count quantification
// ---------------------------------------------------------------------------
// For each settled trade with a prior revaluation: the unrealised accrual
// (lastRevalUnrealisedMinor, posted to fx.receivable/fx.unrealised_pnl) and the
// realised posting (realisedPnlDelta, posted to fx.nostro/fx.realised_pnl) both
// measure the move from the SAME bookRate. With no reversal of the unrealised
// on settlement, the overlapping portion is double-counted in total P&L.
//
// Overlap per trade = the portion of the move from bookRate→settlement that was
// ALSO captured as unrealised. Since unrealised is measured (revalRate−bookRate)
// and realised (settlementRate−bookRate) from the same origin, and revalRate at
// the last pre-settlement reval is the carrying rate, the double-counted amount
// is min(|unrealised|, |realised|) in the common direction — i.e. the unrealised
// accrual that should have been reversed but was not.

let doubleCountSettledTrades = 0;
let doubleCountMinor = 0;
const doubleCountSamples: Array<{
  tradeId: string;
  pair: string;
  bookRate: number;
  lastRevalRate?: number;
  unrealisedMinor: number;
  realisedMinor: number;
  overlapMinor: number;
}> = [];

for (const t of settledWithReval) {
  const unreal = t.lastRevalUnrealisedMinor ?? 0;
  const real = t.realisedPnlDelta ?? 0;
  if (unreal === 0 || real === 0) continue;
  // Same-sign overlap = the unrealised accrual not reversed (double-booked).
  const overlap = Math.sign(unreal) === Math.sign(real) ? Math.min(Math.abs(unreal), Math.abs(real)) : 0;
  if (overlap === 0) continue;
  doubleCountSettledTrades += 1;
  doubleCountMinor += overlap;
  if (doubleCountSamples.length < 8) {
    doubleCountSamples.push({
      tradeId: t.tradeId,
      pair: t.pair,
      bookRate: t.bookRate,
      lastRevalRate: t.lastRevalRate,
      unrealisedMinor: unreal,
      realisedMinor: real,
      overlapMinor: overlap,
    });
  }
}

const fmt = (minor: number) => `R${(minor / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

console.log("════════════════════════════════════════════════════════════════");
console.log(" FX P&L INSTRUMENT-LEVEL GAP — quantification (READ-ONLY)");
console.log(" Authority: D-FX-PNL-INSTRUMENT-LEVEL-VALUATION");
console.log("════════════════════════════════════════════════════════════════");
console.log("");
console.log("Population (canonical store):");
console.log(`  FxTradeExecuted        : ${trades.size}`);
console.log(`  …settled (SettlementConfirmed): ${settled.length}`);
console.log(`  …settled WITH ≥1 reval : ${settledWithReval.length}`);
console.log(`  RealisedPnlRecognised  : ${realisedRecognisedCount} (correct CSH close-out path), sum ${fmt(realisedRecognisedSumMinor)}`);
console.log("");
console.log("─── (A) IAS 21 §23(a) frozen-FCY retranslation gap ───");
console.log(`  Settled FCY base notional frozen out of revaluation: ${settledBaseNotionalMinor} minor (base ccy units)`);
for (const [ccy, minor] of [...settledByCcy.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`     ${ccy}: ${(minor / 100).toLocaleString("en-ZA")} (base units)`);
}
console.log(`  Stranded accrued unrealised on settled trades (carried but never derecognised/reversed): ${fmt(strandedAccruedMinor)}`);
console.log(`     → this is the GL fx.receivable/fx.unrealised_pnl balance attributable to settled positions that are`);
console.log(`       no longer revalued; it is frozen at the last pre-settlement reval and bears no further retranslation.`);
console.log("");
console.log("─── (B) Realised/unrealised double-count ───");
console.log(`  Settled trades with overlapping (same-direction) unrealised + realised: ${doubleCountSettledTrades}`);
console.log(`  DOUBLE-COUNTED amount (unrealised accrual not reversed on settlement): ${fmt(doubleCountMinor)}`);
console.log("");
console.log("  Sample (first 8):");
for (const s of doubleCountSamples) {
  console.log(
    `    ${s.tradeId.slice(0, 16)} ${s.pair} book=${s.bookRate} reval=${s.lastRevalRate ?? "—"} ` +
      `unreal=${fmt(s.unrealisedMinor)} real=${fmt(s.realisedMinor)} overlap=${fmt(s.overlapMinor)}`,
  );
}
console.log("");
console.log("Verdict inputs emitted. Interpretation is in the filed diagnosis (RecordFiled).");
