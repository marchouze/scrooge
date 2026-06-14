// scripts/recompute-sa-ccr-v2-alias-flip.ts
//
// SA-CCR ALIAS-FLIP correction run (WS-V2-BBAAS). Authority:
// D-SACCR-V2-CUTOVER-ACCELERATE (CEO-approved 2026-06-13); D-W4-MODEL-LIBRARY-
// PILOT; D-MODEL-BINDING-CONTRACT-V1. Brief
// `brief:rohan:sa-ccr-alias-flip-v2-sole-live-emitter-v1-retire:2026-06-13`.
//
// WHAT THIS DOES
// --------------
// Re-emits the affected `CcrReplacementCostComputed` + `CcrEadComputed` events
// of record through the FLIPPED, v2-sourced emitter (`computeAndEmit`), with
// the RC inputs reconstructed for the SAME book the defective recorded events
// covered (the live netting sets + trades + marks as-of the recorded valuation
// date, 2026-06-11), but stamped at a CURRENT correction computationDate so the
// projections adopt the corrected figure as the latest event of record.
//
// WHY THE INPUTS ARE PINNED TO THE RECORDED VALUATION DATE
// --------------------------------------------------------
// The recorded 2026-06-11 RC/EAD were produced by the v1 input-resolution layer
// whose FX `resolveMtm` arm SUMMED `FxPositionRevalued.unrealisedPnlZarMinor`
// across revaluations as if it were a per-period delta — it is the FULL
// cumulative mark recomputed each EOD, so summing N revals N-counted V. The
// trades that produced those figures have since settled/matured, so a flat
// current book would emit nothing and leave the DEFECTIVE figures standing as
// the latest event of record (feeding CreditRWA / BA-700 / CVA). The correct
// restatement reconstructs the SAME book as-of the recorded valuation date and
// re-prices it under the validated v2 latest-per-trade MtM basis (Valuable
// feed), then emits the correction at a later computationDate so the projection's
// latest-by-computationDate selection adopts it.
//
// PRINCIPLE 1: corrected events are APPENDED; the historical (defective) events
// are NEVER mutated — they remain in the log as the audit trail of the defect.
//
// Idempotent: skips emission for a netting set already corrected at
// CORRECTION_DATE (a re-run is a no-op).
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/recompute-sa-ccr-v2-alias-flip.ts
//
// Author: Rohan (Risk Engineer, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import type { CcrEadComputedPayloadV2Type } from "../platform/event-store/event-types/counterparty-credit-risk";
import { minorFromMoneyWire } from "../platform/core/money-codec";
import { resolveNettingSet } from "../platform/markets/netting-sets";
import { logger } from "../platform/observability/logger";
import { computeAndEmit } from "../platform/risk/sa-ccr/compute-and-emit";
import {
  sourceCollateralFromRegister,
  sourceVMtmFromValuableFeed,
} from "../platform/risk/sa-ccr/fil-valuable-collateral-feed";
import { buildFxSaCcrTradeSummaries } from "../platform/risk/sa-ccr/positions-to-summaries";

// The recorded valuation date the defective figures were computed at — the book
// is reconstructed as-of this instant (trades + marks of record).
const RECORDED_VALUATION_AS_OF = "2026-06-11T17:00:00.000Z";
// The correction computation date — strictly later than the recorded
// computationDate (2026-06-11) so the projection's latest-by-computationDate
// selection adopts the corrected event of record.
const CORRECTION_AS_OF = "2026-06-13T17:00:00.000Z";
const CORRECTION_DATE = CORRECTION_AS_OF.slice(0, 10);

const CITATIONS = [
  "D-SACCR-V2-CUTOVER-ACCELERATE",
  "D-MODEL-BINDING-CONTRACT-V1",
  "BCBS-SA-CCR-CRE52",
  "Policies/credit-risk-policy-v1.md#3",
];

// ---------------------------------------------------------------------------
// Latest recorded EAD per netting set (before/after snapshots).
// ---------------------------------------------------------------------------

function latestEadByNs(): Map<string, { rc: number; pfe: number; ead: number; date: string }> {
  const by = new Map<string, { rc: number; pfe: number; ead: number; date: string }>();
  for (const ev of eventStore.replay({ type: "CcrEadComputed" })) {
    // DECIMAL-MIGRATION (slice 2): rc/pfe/ead are MoneyWire — decode to minor units.
    const p = ev.payload as CcrEadComputedPayloadV2Type;
    const prev = by.get(p.nettingSetId);
    if (prev && prev.date >= p.computationDate) continue;
    by.set(p.nettingSetId, {
      rc: minorFromMoneyWire(p.rc),
      pfe: minorFromMoneyWire(p.pfe),
      ead: minorFromMoneyWire(p.ead),
      date: p.computationDate,
    });
  }
  return by;
}

const before = latestEadByNs();

// Netting sets already corrected at CORRECTION_DATE (idempotency).
const alreadyCorrected = new Set<string>();
for (const ev of eventStore.replay({ type: "CcrEadComputed" })) {
  const p = ev.payload as CcrEadComputedPayloadV2Type;
  if (p.computationDate === CORRECTION_DATE) alreadyCorrected.add(p.nettingSetId);
}

// ---------------------------------------------------------------------------
// Reconstruct the recorded-date book + re-emit corrected figures.
// ---------------------------------------------------------------------------

const groups = buildFxSaCcrTradeSummaries(eventStore, RECORDED_VALUATION_AS_OF);
const emitted: string[] = [];
const skipped: string[] = [];

for (const [nettingSetId, grp] of groups) {
  if (alreadyCorrected.has(nettingSetId)) {
    skipped.push(nettingSetId);
    continue;
  }
  const ns = resolveNettingSet(grp.counterpartyId, grp.currency, RECORDED_VALUATION_AS_OF);
  if (!ns) {
    skipped.push(nettingSetId);
    continue;
  }
  // computeAndEmit auto-resolves vMtm via the Valuable feed (latest *Revalued
  // event-of-record per trade) + collateral via the register, both as-of the
  // `asOf` passed. We want the marks-of-record AS-OF THE RECORDED VALUATION
  // DATE but the computationDate stamped at the correction date — so we resolve
  // the feeds at RECORDED_VALUATION_AS_OF explicitly and thread them in, while
  // passing the later asOf for the computationDate stamp.
  // (Threading the feed-sourced inputs is the test-seam path on computeAndEmit.)
  const vMtmV2 = sourceVMtmFromValuableFeed(eventStore, {
    counterpartyId: ns.counterpartyId,
    currency: ns.currency,
    asOf: RECORDED_VALUATION_AS_OF,
  });
  const collateralV2 = sourceCollateralFromRegister({
    currency: ns.currency,
    asOf: RECORDED_VALUATION_AS_OF,
  });

  computeAndEmit({
    nettingSet: ns,
    trades: grp.trades,
    // Pin the corrected RC inputs to the recorded-date marks (v2 basis).
    vMtm: { amount: vMtmV2.minorUnits, currency: ns.currency as never },
    collateralHeld: { amount: collateralV2.minorUnits, currency: ns.currency as never },
    asOf: CORRECTION_AS_OF,
    citations: CITATIONS,
  });
  emitted.push(nettingSetId);
}

const after = latestEadByNs();

const deltas = emitted.map((nsId) => {
  const b = before.get(nsId);
  const a = after.get(nsId);
  return {
    nettingSetId: nsId,
    beforeRcMinor: b?.rc ?? 0,
    afterRcMinor: a?.rc ?? 0,
    beforeEadMinor: b?.ead ?? 0,
    afterEadMinor: a?.ead ?? 0,
    eadDeltaMinor: (a?.ead ?? 0) - (b?.ead ?? 0),
  };
});

logger.info(
  {
    recordedValuationAsOf: RECORDED_VALUATION_AS_OF,
    correctionAsOf: CORRECTION_AS_OF,
    emitted,
    skipped,
    at: clock.now(),
  },
  "SA-CCR v2 alias-flip correction run complete",
);

const totalEadDelta = deltas.reduce((s, d) => s + d.eadDeltaMinor, 0);

console.log(
  JSON.stringify(
    {
      ok: true,
      recordedValuationAsOf: RECORDED_VALUATION_AS_OF,
      correctionAsOf: CORRECTION_AS_OF,
      emittedNettingSets: emitted.length,
      skipped: skipped.length,
      deltas,
      totalEadDeltaMinor: totalEadDelta,
      note: "Minor units (ZAR cents). Corrected events APPENDED (Principle 1); historical defective events retained in the log. EAD delta feeds CreditRWA × 12.5 / 100% RW into BA-700 leverage exposure.",
    },
    null,
    2,
  ),
);

process.exit(0);
