// scripts/file-nadia-v2-a4-fx-gl-cutover-validation.ts
//
// Independent model-risk validation of the A4 FX GL cutover METHODOLOGY,
// by Nadia (Independent model-validation engineer, second line) — a distinct
// plane from implementation (Atlas (Core banking platform architect,
// engineering) / Bea (Accounting & financial reporting engineer, engineering)).
//
// Brief: `brief:nadia:independent-validation-fx-a4-gl-cutover-methodol:2026-06-13`
// Run:   `run:nadia:2026-06-13T18-18-09-925Z`
// Authority: D-FIL-ATTRIBUTION-A1-BUILD (reviewer→decider primitive);
//            D-FX-PNL-INSTRUMENT-LEVEL-VALUATION.
//
// VERDICT: VALIDATED-WITH-CONDITIONS (4 findings, 1 blocking condition MV-FX-A4-004).
//
// KEY OUTCOME: MV-FX-A2-002 (HIGH, from prior run PR #1319) is **CLOSED**.
// The A4 methodology specification correctly resolves the gross-vs-delta problem
// by posting Δ(gross book value) as unrealised P&L, not gross value. The first-
// day baseline posting, RealisedPnlRecognised GL rule, pr-fx-lifecycle-close
// retirement, and IAS-21 §23a FCY-cash treatment are all correct. One new
// blocking condition (MV-FX-A4-004) concerns the "previous EOD snapshot" sourcing
// mechanism — that mechanism must be specified and independently validated before
// the GL cutover executes.
//
// Emits, in order, Principle-1 typed events:
//   1. ValidationFindingRaised × 5
//   2. ModelValidationApproved (verdict — A4 methodology conditionally cleared,
//      MV-FX-A2-002 resolved)
//   3. RecordFiled (this validation report in the Documents register)
//
// Idempotent — skips if the validation record is already filed.
//
// Author: Nadia (Independent model-validation engineer, second line).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import {
  makeModelValidationApproved,
  makeValidationFindingRaised,
} from "../platform/event-store/event-types/model-risk";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:nadia:v2-a4-fx-gl-cutover-validation:2026-06-13";
const MODEL_ID = "fx-valuation";
const MODEL_VERSION = "1.0";
const ENTITY = String(BANK_ZA_001);

const ACTOR = { type: "service" as const, id: "agent:nadia:model-validation" };
const CITATIONS = [
  "D-FIL-ATTRIBUTION-A1-BUILD",
  "D-FX-PNL-INSTRUMENT-LEVEL-VALUATION",
  "D-MODEL-BINDING-CONTRACT-V1",
  "D-FIL-FRAMEWORK-UNIFICATION",
  "D-FIL-BOOK-COMPOSITE-VALUATION",
  "urn:reg:iasb:ias-21:§23",
  "urn:reg:iasb:ias-21:§28",
  "urn:reg:iasb:ifrs-9:§5.7.1",
  "urn:reg:iasb:ifrs-9:§4.1.4",
  "SR-11-7",
];

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);
if (alreadyFiled) {
  console.log(`[file-nadia-v2-a4-fx-gl-cutover-validation] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Findings — 5 findings covering the A4 GL cutover methodology.
// Finding MV-FX-A4-001 formally closes MV-FX-A2-002 from PR #1319.
// MV-FX-A4-004 is the sole blocking condition.
// ---------------------------------------------------------------------------

const FINDINGS: Array<{
  findingId: string;
  severity: "low" | "medium" | "high" | "blocking";
  description: string;
}> = [
  {
    findingId: "MV-FX-A4-001",
    severity: "low",
    description:
      "CLOSES MV-FX-A2-002 (HIGH, PR #1319): the A4 methodology specification correctly " +
      "resolves the gross-vs-delta concern raised in the prior validation. The A4 design " +
      "posts Δ(gross book value) — i.e. v2_book_value(today) − v2_book_value(yesterday) — " +
      "as the period unrealised FVTPL P&L movement, NOT the gross value itself as P&L. " +
      "The first-day-after-cutover baseline posting (post full gross as the first Δ, " +
      "because there is no prior A4 snapshot) is methodologically correct: it is " +
      "equivalent to Δ(gross) where the prior day's A4 value was zero. This prevents " +
      "double-counting of previously-posted unrealised amounts (the v1 path is retired " +
      "in the same PR, eliminating the race). MV-FX-A2-002 is CLOSED by this finding.",
  },
  {
    findingId: "MV-FX-A4-002",
    severity: "low",
    description:
      "CONFIRMED — RealisedPnlRecognised GL posting rule: Dr fx.realised_pnl / Cr " +
      "fx.nostro[settlementCcy] for the realisedAmount (MoneyWire, V2) is correct " +
      "double-entry. The debit to fx.realised_pnl recognises the P&L crystallisation " +
      "as an income statement movement (credit = gain, debit = loss); the credit to " +
      "fx.nostro[settlementCcy] records the settlement proceeds in the correspondent " +
      "account. The realisedAmount is the wavg-cost close-out result (a DELTA amount, " +
      "not gross book value) — dimensionally consistent with a P&L close-out entry. " +
      "Retiring pr-fx-lifecycle-close in the same PR eliminates the prior double-posting " +
      "risk (SettlementConfirmed.realisedPnlDelta was always 0; the prior rule was " +
      "effectively dormant; but its schema presence was a latent risk). Confirmed clean.",
  },
  {
    findingId: "MV-FX-A4-003",
    severity: "low",
    description:
      "CONFIRMED — IAS-21 §23a FCY-cash treatment: value = notional × closingRate(asOf) " +
      "is the correct treatment for FCY cash held as a monetary item. Under IAS-21 §23(a), " +
      "foreign-currency monetary items are translated at the closing rate at the end of " +
      "the reporting period. The fcy-cash-model.ts Valuable implements exactly this: " +
      "`value(marks, asOf) = balanceMinor × closingRate(asOf)` where the closing rate " +
      "is the spot observable in the marks slice for that asOf. The R1,384,290.55 " +
      "frozen-FCY gap auto-closes because the FcyCashInstrument is retranslated daily " +
      "at the closing rate via this Valuable — the gap was a consequence of settled " +
      "FCY cash having no valuation model, not an incorrect rate or balance. " +
      "IAS-21 §23(a) compliance is confirmed: the retranslation hits P&L (FVTPL / " +
      "monetary-item retranslation channel), not OCI (the hedge-accounting path which " +
      "is out of scope for the trading book).",
  },
  {
    findingId: "MV-FX-A4-004",
    severity: "blocking",
    description:
      "BLOCKING — Previous EOD snapshot sourcing mechanism unspecified: the Δ(gross) " +
      "unrealised P&L posting requires `v2_book_value(yesterday)` — the prior EOD " +
      "gross book value. The A4 methodology states this will be sourced from a 'prior " +
      "EOD snapshot event', but the event TYPE, the projection query, and the staleness " +
      "handling rules are not yet specified in the current codebase. Specifically: " +
      "(a) what event kind records the EOD v2 gross book value snapshot? " +
      "(b) how does A4 query 'the most recent prior A4 snapshot for asOf = yesterday'? " +
      "(c) if no prior snapshot exists (cutover day), is the baseline-posting path " +
      "correctly gated without also triggering the delta path? " +
      "(d) if a snapshot is missing for a non-cutover day (missed EOD run), does A4 " +
      "fall back to the last available snapshot (risk: stale delta) or error? " +
      "CONDITION: A4 must define the EOD snapshot event type, the look-back query, " +
      "the cutover-day baseline guard, and the missed-run error policy. These must be " +
      "presented to the validator for re-review before the GL cutover executes. The " +
      "delta arithmetic itself is correct; this finding is about the operationalisation " +
      "of 'previous day' in a Principle-1 event-sourced store.",
  },
  {
    findingId: "MV-FX-A4-005",
    severity: "medium",
    description:
      "ONGOING-MONITORING REQUIREMENT (post-cutover parallel run and parity gate): " +
      "once A4 makes v2 the FX GL source-of-record, a parallel-run must compare v2 " +
      "book-aggregate gross values against the GL trial balance (independent source) " +
      "over a soak window. The existing recon:fx-book-nop-parity gate (MV-FX-A2-003 " +
      "caveat) is not independent of the NOP fold; a genuine GL-vs-v2 parity gate " +
      "comparing v2 book-composite value against the ACC-2100 trial balance rows is " +
      "required as the post-A4 independent check. Daily reconciliation to within " +
      "rounding tolerance, with any divergence dispositioned (BacktestRun / " +
      "BacktestBreachDisposed). This gate was identified as post-A4 follow-up in " +
      "MV-FX-A2-003; it is now a formal post-cutover monitoring condition. " +
      "methodologyHash (computeFxMethodologyHash) remains the drift anchor — any " +
      "change to load-bearing constants re-opens validation.",
  },
];

for (const f of FINDINGS) {
  const ev = makeValidationFindingRaised({
    asOf: clock.now(),
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      findingId: f.findingId,
      modelId: MODEL_ID,
      raisedBy: "Nadia (Independent model-validation engineer, second line)",
      severity: f.severity,
      description: f.description,
    },
  });
  eventStore.append(ev);
  console.log(`[finding] ${f.findingId} (${f.severity}) ${ev.event_id}`);
}

// ---------------------------------------------------------------------------
// The verdict — ModelValidationApproved (A4 methodology conditionally cleared).
// The A4 methodology is VALIDATED WITH CONDITIONS. MV-FX-A2-002 is formally
// RESOLVED by MV-FX-A4-001. The sole blocking condition (MV-FX-A4-004) gates
// the GL cutover on the EOD snapshot sourcing specification. Non-blocking
// conditions (MV-FX-A4-002, -003 low; MV-FX-A4-005 medium) do not block the
// cutover but must be tracked to closure.
// ---------------------------------------------------------------------------

const approval = makeModelValidationApproved({
  asOf: clock.now(),
  entity: ENTITY,
  actor: ACTOR,
  citations: CITATIONS,
  payload: {
    modelId: MODEL_ID,
    version: MODEL_VERSION,
    approvedBy: "Nadia (Independent model-validation engineer, second line)",
    // MV-FX-A2-002 is the finding being formally resolved by this validation.
    // MV-FX-A4-001 records the resolution rationale; it is LOW (no methodology
    // defect remains open). MV-FX-A4-004 is BLOCKING — gates the GL cutover
    // execution on the EOD-snapshot-sourcing spec, not this approval event.
    validationFindingsResolved: ["MV-FX-A2-002"],
    expiryDate: "2027-06-13",
  },
});
eventStore.append(approval);
console.log(
  `[verdict] ModelValidationApproved (A4 methodology validated-with-conditions; MV-FX-A2-002 CLOSED) ${approval.event_id}`,
);

// ---------------------------------------------------------------------------
// The validation report — RecordFiled, Documents register.
// ---------------------------------------------------------------------------

const body = `# Independent model validation — A4 FX GL cutover methodology

**Validator:** Nadia (Independent model-validation engineer, second line) — independent of implementation (Atlas (Core banking platform architect, engineering) / Bea (Accounting & financial reporting engineer, engineering)).
**Date:** 2026-06-13
**Prior validation:** PR #1319 — \`ModelValidationApproved\` bad035d5 (VALIDATED-WITH-CONDITIONS/restrict-envelope, 4 findings including MV-FX-A2-002 HIGH).
**Brief:** \`brief:nadia:independent-validation-fx-a4-gl-cutover-methodol:2026-06-13\`; run \`run:nadia:2026-06-13T18-18-09-925Z\`.
**Authority:** D-FIL-ATTRIBUTION-A1-BUILD (reviewer→decider primitive); D-FX-PNL-INSTRUMENT-LEVEL-VALUATION; D-FIL-BOOK-COMPOSITE-VALUATION.
**Verdict event:** \`ModelValidationApproved\` — \`fx-valuation\` v1.0, A4 GL cutover methodology validated-with-conditions.

---

## VERDICT: VALIDATED-WITH-CONDITIONS — A4 conditionally cleared; MV-FX-A2-002 CLOSED

The A4 FX GL cutover methodology is **validated with conditions**. The core accounting treatments — Δ(gross) unrealised P&L posting, RealisedPnlRecognised GL rule, pr-fx-lifecycle-close retirement, and FCY-cash IAS-21 §23a retranslation — are **correct and consistent with IFRS 9 / IAS 21**. MV-FX-A2-002 (HIGH, from PR #1319) is **formally CLOSED** by this validation.

**One blocking condition (MV-FX-A4-004)** gates the GL cutover execution: the EOD snapshot sourcing mechanism (the "previous day's gross book value" required for the Δ computation) is not yet specified in the codebase. This must be resolved and re-reviewed before the cutover executes.

---

## 1. Check 1 — Gross-vs-delta fix (MV-FX-A2-002 resolution): CLOSED

**Finding MV-FX-A4-001 (LOW) — MV-FX-A2-002 CLOSED.**

The A4 methodology specification correctly resolves the concern raised in MV-FX-A2-002. The validator confirms:

**Is Δ(gross book value) the correct IFRS 9 / IAS 21 treatment?** Yes. Under IFRS 9 §5.7.1, changes in fair value of FVTPL instruments are recognised in profit or loss. The correct GL entry for a period is the **change** in fair value, not the absolute fair value. Posting the gross value would mis-state P&L on day 2+ (the cumulative position value would be double-counted). Posting Δ(gross) is the correct income-statement movement.

**Does it prevent double-counting?** Yes. The v1 unrealised P&L path (\`runEodFxRevaluation\` emitting \`FxPositionRevalued\` → \`pr-fx-002\` posting) is retired in the same PR as A4. The retirement eliminates the concurrent v1 posting that would otherwise double-count alongside v2. The A4 Δ(gross) posting stands alone as the sole FVTPL movement source after cutover.

**Is the previous-day value correctly sourced from a prior EOD snapshot event?** This is the methodologically correct approach (it is the only Principle-1-compliant way to retrieve "yesterday's" value in an event-sourced store). However, the snapshot event type and query are not yet specified — see MV-FX-A4-004 (BLOCKING).

**Is the first-day-after-cutover baseline posting (full gross) correct?** Yes. On day-D, when no prior A4 snapshot exists, posting the full current gross book value as the period P&L movement is methodologically equivalent to Δ(gross) where the prior-day A4 value is defined as zero. This is correct: it initialises the A4 P&L baseline cleanly, matching the economic position at cutover. The validator confirms this is sound for a first-adoption cutover.

**MV-FX-A2-002 disposition:** CLOSED by MV-FX-A4-001. The A4 methodology correctly implements Δ(gross) semantics. No methodology defect remains.

---

## 2. Check 2 — RealisedPnlRecognised posting rule: CONFIRMED (MV-FX-A4-002, LOW)

**Dr \`fx.realised_pnl\` / Cr \`fx.nostro[settlementCcy]\`** for the \`realisedAmount\` (MoneyWire, V2) is correct double-entry for a realised FX P&L close-out.

- The debit to \`fx.realised_pnl\` records the P&L crystallisation in the income statement (for a gain, this is a credit; for a loss, a debit — the rule correctly handles the signed \`realisedPnlZar\` from \`RealisedPnlRecognisedPayloadV2\`).
- The credit to \`fx.nostro[settlementCcy]\` records the settlement cash receipt in the correspondent account in the settlement currency.
- The \`realisedAmount\` is the wavg-cost close-out result (disposal rate − weighted-avg cost × amount closed) — this is a DELTA amount (the gain/loss), not a gross position value. Dimensionally correct for a P&L posting.

**Retirement of pr-fx-lifecycle-close:** The existing rule (\`PR-FX-LIFECYCLE-CLOSE\`) posts a realised-P&L residual from \`SettlementConfirmed.realisedPnlDelta\`. The validator confirms that this field was always 0 in practice (the settlement path never populated it correctly), so the rule was effectively dormant. Retiring it in the same A4 PR eliminates the double-posting risk (a future code path might populate the field) and is the correct clean-up. Confirmed: retiring pr-fx-lifecycle-close in the same PR as wiring the new RealisedPnlRecognised rule is safe and eliminates double-posting risk entirely.

---

## 3. Check 3 — IAS-21 §23a FCY-cash treatment: CONFIRMED (MV-FX-A4-003, LOW)

\`value = notional × closingRate(asOf)\` is the correct treatment for FCY cash held as a monetary item.

IAS-21 §23(a) states: "Foreign currency monetary items shall be translated using the closing rate." The \`fcy-cash-model.ts\` Valuable implements exactly this: \`value(marks, asOf) = balanceMinor × closingRate(asOf)\` where the closing rate is the spot observable in the marks slice for the reporting date. The FcyCashInstrument is retranslated daily at the closing rate, so:

1. The R1,384,290.55 frozen-FCY gap closes automatically: settled FCY cash that previously had no valuation model is now translated daily at the closing rate. The gap was a consequence of absent infrastructure, not a wrong rate or balance.
2. The retranslation gain/loss hits P&L (via the FVTPL/monetary-retranslation channel), not OCI — correct for the FX trading book (hedge-accounting would route to OCI, but hedge accounting is a named out-of-scope gap with no bearing on the FVTPL book, as confirmed in MV-FX-A2).
3. The FCY notional carried forward is the settlement-date notional (the derecognised receivable's FCY amount), which retranslates correctly at each future reporting date. No trade-date cost is carried — correct under IAS-21 (monetary items are not carried at historical cost; they are retranslated at closing rate).

Confirmed: the IAS-21 §23(a) treatment is correctly implemented.

---

## 4. Check 4 — Parity gate independence (MV-FX-A2-003 follow-up): POST-A4 CONDITION (MV-FX-A4-005, MEDIUM)

The existing \`recon:fx-book-nop-parity\` gate (caveated in MV-FX-A2-003) is **not sufficient** as the sole post-cutover independence check. The gate is sound in the plumbing sense but cannot detect errors in the NOP fold itself (both sides of the gate originate from the same fold). After A4, when v2 drives the GL:

- A genuine GL-vs-v2 parity gate is required: compare v2 book-composite gross value (the sum of \`fxPnlMetric.evaluate()\` across the fx-trading book) against the ACC-2100 unrealised-P&L trial balance rows (the independent GL source).
- This gate is NEW and independent: the GL is populated by the SLA posting engine (independent of the v2 valuation path), so a parity = 0 result would be a genuine independent confirmation.
- **Should A4 include this gate?** The validator's recommendation is: **no, not in A4 itself** (A4 is already scoped to the GL cutover; adding a new recon gate risks delaying the cutover for infrastructure work). Instead, track this as a post-A4 deliverable with a defined SLA (complete within 2 weeks of A4 merge). The existing parity gate is sufficient for the cutover itself, with the MV-FX-A2-003 caveat documented.

This is a **monitoring condition** (MV-FX-A4-005, MEDIUM), not a blocker. The cutover can proceed once MV-FX-A4-004 is resolved.

---

## 5. Blocking condition: EOD snapshot sourcing (MV-FX-A4-004, BLOCKING)

The Δ(gross) unrealised P&L posting methodology requires \`v2_book_value(yesterday)\`. The methodology is correct in principle, but the operationalisation in a Principle-1 event-sourced store requires:

1. **A named EOD snapshot event type** that records the v2 gross book value at end-of-day (e.g. \`FxBookEodSnapshotRecorded\` or equivalent). Without this, the "previous day" value cannot be retrieved from the event log.
2. **A look-back query** that retrieves the most recent prior snapshot for a given asOf date. The query must handle: (a) the cutover-day case (no prior snapshot → baseline posting), (b) the steady-state case (prior snapshot exists → delta posting), and (c) the missed-EOD-run case (snapshot from 2+ days ago → define error policy).
3. **The cutover-day baseline guard**: must be a distinct code path from the delta path, with explicit detection of "no prior A4 snapshot" — not implicit fallback to zero.
4. **The missed-run error policy**: if a prior EOD run was missed, should A4 use the last available snapshot (risk: stale delta, potentially capturing 2+ days of movement as one day's P&L) or hard-error (risk: posting engine stalls)? The validator requires this to be specified and documented.

**These four items are not present in the codebase reviewed.** The validator reviewed: \`fx-model.ts\`, \`fcy-cash-model.ts\`, \`fx-pnl-metric.ts\`, \`methodology.ts\`, \`fx-accounting.ts\`, \`pr-fx-lifecycle-close.ts\`, \`fx-revaluation.ts\`. No EOD snapshot event type was found. The v2 FIL book-aggregate design (D-FIL-BOOK-COMPOSITE-VALUATION) is the correct substrate for this; the snapshot event type must be defined as part of that design.

**Resolution path:** Atlas (Core banking platform architect, engineering) or Bea (Accounting & financial reporting engineer, engineering) must: (a) define the EOD snapshot event type, (b) specify the look-back query and missed-run policy, and (c) present the specification to Nadia (Independent model-validation engineer, second line) for re-review. The re-review is a targeted scope check (snapshot mechanism only); the rest of the A4 methodology is cleared.

---

## 6. Summary

| Finding | Severity | Status |
|---|---|---|
| MV-FX-A4-001 (resolves MV-FX-A2-002) | LOW | CLOSES MV-FX-A2-002 |
| MV-FX-A4-002 — RealisedPnlRecognised rule | LOW | CONFIRMED |
| MV-FX-A4-003 — IAS-21 §23a FCY-cash | LOW | CONFIRMED |
| MV-FX-A4-004 — EOD snapshot sourcing | BLOCKING | OPEN — gates cutover |
| MV-FX-A4-005 — GL parity gate (post-A4) | MEDIUM | OPEN — post-A4 deliverable |

**MV-FX-A2-002:** CLOSED (resolved by MV-FX-A4-001).

**A4 GL cutover status:** CONDITIONALLY CLEARED. The accounting methodology (Δ-gross unrealised P&L, realised P&L rule, IAS-21 §23a) is correct. The sole blocker is MV-FX-A4-004 (EOD snapshot sourcing specification). Once that specification is reviewed and cleared, A4 may execute. The 2dp-consistent envelope restriction from MV-FX-A2-001 continues to apply.
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    supersedes: undefined,
    citations: CITATIONS,
    actor: ACTOR,
    entity: ENTITY,
    metadata: {
      title: "Independent model validation — A4 FX GL cutover methodology",
      path: "2026-06-13_nadia_v2-a4-fx-gl-cutover-validation.md",
      category: "model-validation",
      author: "Nadia (Independent model-validation engineer, second line)",
      date: "2026-06-13",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      verdict: "validated-with-conditions",
      mvFxA2002: "CLOSED",
      blockingCondition: "MV-FX-A4-004 — EOD snapshot sourcing mechanism unspecified",
      a4Cleared: "conditional (MV-FX-A4-004 re-review required before cutover executes)",
      validationEventId: approval.event_id,
      recordFiledEventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
